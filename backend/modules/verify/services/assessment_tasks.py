import asyncio
import json
import logging
from typing import Dict, Any

from backend.core.celery_app import celery_app
from backend.modules.verify.repositories.submission_repo import SubmissionRepository
from backend.modules.verify.repositories.assessment_repo import AssessmentRepository
from backend.common.services.ai.agents import AIAgents
from backend.modules.verify.services.sandbox_service import SandboxService

logger = logging.getLogger(__name__)

async def _async_background_grade(result_id: int, assessment_id: int, user_id: int, answers: Dict[str, Any], tenant_id: str):
    try:
        repo = SubmissionRepository(tenant_id=tenant_id)
        assessment_repo = AssessmentRepository(tenant_id=tenant_id)
        ai_agents = AIAgents()

        asm = assessment_repo.get_assessment_by_id(assessment_id)
        if not asm:
            return

        questions = asm.get("questions", [])

        # Check if candidate was assigned custom_questions (AI variants / local shuffle / subset)
        try:
            from backend.core.database import get_db_connection
            from psycopg2.extras import RealDictCursor
            conn = get_db_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'SET search_path TO "{tenant_id}"')
                cur.execute(
                    "SELECT custom_questions FROM assessment_assignments WHERE assessment_id = %s AND user_id = %s LIMIT 1",
                    (assessment_id, user_id)
                )
                assign_row = cur.fetchone()
            conn.close()

            if assign_row and assign_row.get("custom_questions"):
                cq = assign_row["custom_questions"]
                if isinstance(cq, str):
                    try:
                        cq = json.loads(cq)
                    except Exception:
                        cq = None
                if isinstance(cq, list) and len(cq) > 0:
                    questions = cq
        except Exception as ex:
            logger.warning(f"Could not load custom_questions for grading asm {assessment_id}, user {user_id}: {ex}")

        pass_score = float(asm.get("pass_score", 70.0))

        total_marks = 0.0
        earned_marks = 0.0
        scores_per_q: Dict[str, Any] = {}

        def _check_mcq_match(candidate_ans: Any, correct_ans: Any, options_list: Any) -> bool:
            if candidate_ans is None or correct_ans is None:
                return False
            ans_str = str(candidate_ans).strip()
            ca_str = str(correct_ans).strip()
            if not ans_str or not ca_str:
                return False
            if ans_str.upper() == ca_str.upper():
                return True
            import re
            def norm(s: str) -> str:
                s = s.strip()
                s = re.sub(r'^(?:[A-Fa-f0-9][\.\)\:\-]\s*|\([A-Fa-f0-9]\)\s*)', '', s)
                return s.strip().upper()
            if norm(ans_str) == norm(ca_str):
                return True
            
            opts = options_list or []
            if isinstance(opts, str):
                try: opts = json.loads(opts)
                except Exception: opts = []
            
            letter_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5}
            ca_upper = ca_str.upper()
            if ca_upper in letter_map:
                idx = letter_map[ca_upper]
                if 0 <= idx < len(opts):
                    target_opt = str(opts[idx]).strip()
                    if ans_str.upper() == target_opt.upper() or norm(ans_str) == norm(target_opt):
                        return True
            ans_upper = ans_str.upper()
            if ans_upper in letter_map:
                idx = letter_map[ans_upper]
                if 0 <= idx < len(opts):
                    target_opt = str(opts[idx]).strip()
                    if ca_str.upper() == target_opt.upper() or norm(ca_str) == norm(target_opt):
                        return True
            return False

        for i, q in enumerate(questions):
            qid = str(q.get("id") if q.get("id") is not None else i)
            # Lookup candidate answer by string ID, raw ID, or 0-based index
            candidate_answer = answers.get(qid)
            if candidate_answer is None and q.get("id") is not None:
                candidate_answer = answers.get(q["id"])
            if candidate_answer is None and str(i) in answers:
                candidate_answer = answers[str(i)]
            if candidate_answer is None and i in answers:
                candidate_answer = answers[i]
            if candidate_answer is None:
                candidate_answer = ""

            marks = float(q.get("marks") or 1.0)
            total_marks += marks
            q_type = (q.get("question_type") or "").lower()
            score = 0.0

            if q_type == "mcq":
                score = marks if _check_mcq_match(candidate_answer, q.get("correct_answer"), q.get("options")) else 0.0

            elif q_type == "mcq_multi":
                correct_raw = q.get("correct_answer") or ""
                if isinstance(correct_raw, list):
                    raw_items = correct_raw
                else:
                    try:
                        raw_items = json.loads(correct_raw) if correct_raw.startswith('[') else correct_raw.split(',')
                    except Exception:
                        raw_items = str(correct_raw).split(',')
                
                correct_items = [str(x).strip() for x in raw_items if str(x).strip()]
                cand_items = candidate_answer if isinstance(candidate_answer, list) else [candidate_answer]
                cand_items = [str(x).strip() for x in cand_items if str(x).strip()]

                all_matched = (len(cand_items) == len(correct_items) and len(correct_items) > 0)
                if all_matched:
                    for ci in cand_items:
                        if not any(_check_mcq_match(ci, cor, q.get("options")) for cor in correct_items):
                            all_matched = False
                            break
                score = marks if all_matched else 0.0

            elif q_type == "coding":
                try:
                    svc = SandboxService()
                    lang = q.get("programming_language") or "python"
                    code = str(candidate_answer)
                    tc_raw = q.get("test_cases") or []
                    test_cases = tc_raw if isinstance(tc_raw, list) else json.loads(tc_raw or "[]")
                    sandbox_result = await svc.execute_code_sandbox(lang, code, "", test_cases)
                    tr = sandbox_result.get("test_results", [])
                    passed_count = sum(1 for t in tr if t.get("passed"))
                    total_count = len(tr) if tr else 1
                    score = round(marks * passed_count / total_count, 2)
                except Exception as ex:
                    logger.warning(f"Coding sandbox failed for q{qid}: {ex}")
                    score = 0.0

            elif q_type == "written":
                try:
                    grade_result = await ai_agents.ai.generate_json(
                        prompt=json.dumps({
                            "question": q.get("question_text"),
                            "model_answer": q.get("model_answer"),
                            "candidate_answer": candidate_answer,
                            "max_marks": marks,
                        }),
                        system_prompt=(
                            "You are a grading AI. Grade this written answer.\n"
                            "Respond ONLY with JSON: {\"score\": <float>, \"feedback\": \"<string>\"}"
                        ),
                    )
                    score = min(float(grade_result.get("score", 0)), marks)
                except Exception as ex:
                    logger.warning(f"Written grading failed for q{qid}: {ex}")
                    score = 0.0

            elif q_type == "file_upload":
                scores_per_q[qid] = {"score": None, "max": marks, "status": "pending_review", "answer_provided": candidate_answer}
                continue

            earned_marks += score
            scores_per_q[qid] = {"score": score, "max": marks, "answer_provided": candidate_answer}

        pct_score = round((earned_marks / total_marks * 100) if total_marks > 0 else 0.0, 2)
        passed = pct_score >= pass_score

        # Generate AI feedback
        try:
            feedback_data = await ai_agents.generate_assessment_feedback(
                questions=questions,
                answers=answers,
                scores=scores_per_q,
                total_score=pct_score,
                passed=passed,
            )
            feedback_str = json.dumps(feedback_data)
        except Exception as e:
            logger.warning(f"AI feedback generation failed: {e}")
            feedback_str = json.dumps({"summary": "Grading complete.", "passed": passed})

        # Persist results
        repo.update_result_grading(result_id, assessment_id, user_id, scores_per_q, pct_score, passed, feedback_str)
        logger.info(f"Background grading completed successfully for result_id: {result_id}")
    except Exception as e:
        logger.error(f"Background grading failed for result {result_id}: {e}")

@celery_app.task(name="grade_assessment_task")
def grade_assessment_task(result_id: int, assessment_id: int, user_id: int, answers: Dict[str, Any], tenant_id: str):
    """Celery task to grade assessments asynchronously."""
    asyncio.run(_async_background_grade(result_id, assessment_id, user_id, answers, tenant_id))
