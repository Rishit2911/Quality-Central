import asyncio
import json
import logging
from typing import List, Dict, Any, Optional

from backend.modules.verify.repositories.assignment_repo import AssignmentRepository
from backend.modules.verify.repositories.assessment_repo import AssessmentRepository
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class AssignmentService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = AssignmentRepository(tenant_id=tenant_id)
        self.assessment_repo = AssessmentRepository(tenant_id=tenant_id)
        self.ai = AIAgents()

    def get_user_assignments(self, user_id: int) -> List[Dict[str, Any]]:
        return self.repo.get_user_assignments(user_id)

    def get_assignment_candidates(self, asm_id: int) -> List[Dict[str, Any]]:
        return self.repo.get_assignment_candidates(asm_id)

    def get_recent_assignments(self, limit: int = 10) -> List[Dict[str, Any]]:
        return self.repo.get_recent_assignments(limit)

    def get_assignable_users(self, assessment_id: Optional[int] = None) -> List[Dict[str, Any]]:
        return self.repo.get_assignable_users(assessment_id=assessment_id)

    def _shuffle_questions_for_user(self, questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Shuffles questions and MCQ options per candidate.
        Preserves section grouping if sections exist, while randomizing question order within sections.
        """
        import copy
        import random

        if not questions:
            return []

        user_questions = copy.deepcopy(questions)

        # 1. Shuffle options inside each MCQ question
        for q in user_questions:
            options = q.get("options")
            if isinstance(options, str):
                try:
                    options = json.loads(options)
                except Exception:
                    options = []
            if isinstance(options, list) and len(options) > 1:
                shuffled_opts = list(options)
                random.shuffle(shuffled_opts)
                q["options"] = shuffled_opts

        # 2. Shuffle questions within each section, or globally if no sections
        has_sections = any(q.get("section_id") is not None for q in user_questions)
        if has_sections:
            section_map = {}
            for q in user_questions:
                sec_id = q.get("section_id")
                section_map.setdefault(sec_id, []).append(q)

            final_list = []
            curr_idx = 0
            for sec_id, s_questions in section_map.items():
                random.shuffle(s_questions)
                for q in s_questions:
                    q["order_index"] = curr_idx
                    curr_idx += 1
                    final_list.append(q)
            return final_list
        else:
            random.shuffle(user_questions)
            for idx, q in enumerate(user_questions):
                q["order_index"] = idx
            return user_questions

    async def assign_assessment(
        self, asm_id: int, user_ids: List[int], assigned_by: int, 
        deadline: Optional[str] = None, generate_variants: bool = False,
        question_ids: Optional[List[int]] = None, shuffle_questions: bool = False,
        proctoring_strictness: Optional[str] = None, proctoring_config: Optional[Dict[str, Any]] = None
    ) -> int:
        """Assign users to an assessment, blocking already-assigned candidates from re-assignment."""
        # Check if assessment exists
        asm = self.assessment_repo.get_assessment_by_id(asm_id)
        if not asm:
            raise ValueError("Assessment not found")

        # Block re-assignment: partition into new vs already assigned (exempt cluxssy25@gmail.com)
        already_assigned = []
        new_uids = []
        for uid in user_ids:
            u_info = self.repo.get_user_info(uid)
            email = (u_info.get("email") or "").lower() if u_info else ""
            is_exempt = email == "cluxssy25@gmail.com"

            existing = self.repo.get_assignment(asm_id, uid)
            if existing and not is_exempt:
                already_assigned.append(uid)
            else:
                new_uids.append(uid)

        if not new_uids:
            raise ValueError("All selected candidate(s) are already assigned to this assessment and cannot be re-assigned.")

        # Determine effective proctoring config
        final_proctoring_config = proctoring_config
        if not final_proctoring_config and proctoring_strictness:
            final_proctoring_config = {"strictness": proctoring_strictness}

        assigned_count = 0
        base_questions = asm.get('questions', [])
        
        # Pre-filter by subset if provided
        if question_ids:
            base_questions = [q for q in base_questions if q.get('id') in question_ids]

        for uid in new_uids:
            existing = self.repo.get_assignment(asm_id, uid)
            if existing:
                self.repo.update_assignment_status(
                    asm_id, uid, "pending", deadline=deadline, proctoring_config=final_proctoring_config
                )
            else:
                self.repo.create_assignment(
                    asm_id, uid, assigned_by, deadline, proctoring_config=final_proctoring_config
                )
            assigned_count += 1

            # Determine initial custom questions
            if generate_variants and base_questions:
                # Set an initial shuffled version immediately so the test is playable right away
                initial_qs = self._shuffle_questions_for_user(base_questions)
                self.repo.update_custom_questions(asm_id, uid, initial_qs)
            elif shuffle_questions and base_questions:
                # Local randomized shuffle per user
                shuffled = self._shuffle_questions_for_user(base_questions)
                self.repo.update_custom_questions(asm_id, uid, shuffled)
            elif question_ids:
                # Custom question subset without shuffling
                self.repo.update_custom_questions(asm_id, uid, base_questions)

        # Best-effort email + in-app notification for new assignments
        try:
            from backend.core.email_service_extended import send_assessment_notification_email
            from backend.modules.deploy.services.notification_service import add_notification
            import os
            asm_title = asm.get('title') or 'Assessment'
            duration = asm.get('time_limit_minutes')
            pass_score = asm.get('pass_score')
            question_count = len(base_questions) if base_questions else None

            # Resolve tenant company name and subdomain
            company_name = os.getenv("COMPANY_NAME") or "Phygitron 360"
            subdomain = None
            if self.tenant_id and self.tenant_id != 'public':
                try:
                    from backend.core.database import get_db_connection
                    conn = get_db_connection()
                    with conn.cursor() as cur:
                        cur.execute("SELECT company_name, subdomain FROM public.tenants WHERE id = %s", (self.tenant_id,))
                        row = cur.fetchone()
                        if row:
                            if row[0]:
                                company_name = row[0]
                            subdomain = row[1]
                    conn.close()
                except Exception as ex:
                    logger.warning(f"Could not load tenant info for assignment notification: {ex}")

            # Construct direct portal URL for Verify / Candidate assessment view
            if subdomain:
                portal_link = f"https://{subdomain}.phygitron.com/verify"
            else:
                env_base = os.getenv("APP_BASE_URL")
                portal_link = f"{env_base.rstrip('/')}/verify" if env_base else "https://app.phygitron.com/verify"

            for uid in new_uids:
                u_info = self.repo.get_user_info(uid)
                if u_info and u_info.get("email"):
                    c_name = u_info.get("name")
                    if not c_name and u_info.get("email"):
                        raw_handle = u_info["email"].split("@")[0]
                        c_name = raw_handle.replace(".", " ").replace("_", " ").replace("-", " ").title()

                    send_assessment_notification_email(
                        to_email=u_info["email"],
                        candidate_name=c_name or "Team Member",
                        assessment_title=asm_title,
                        company_name=company_name,
                        deadline=deadline or "Within 48 hours",
                        duration_mins=duration,
                        question_count=question_count,
                        pass_score=pass_score,
                        assessment_link=portal_link
                    )

                add_notification(
                    title="New Assessment Assigned",
                    message=f"You have been assigned: {asm_title}. Please complete it before the deadline.",
                    user_id=uid,
                    n_type="Alert",
                    tenant_id=self.tenant_id
                )
        except Exception as e:
            logger.warning(f"Assessment notification failed (non-blocking): {e}")

        # Generate AI variants in background
        if generate_variants and base_questions:
            asyncio.create_task(
                self._generate_variants_background(asm_id, new_uids, base_questions)
            )

        return assigned_count

    async def _generate_variants_background(
        self, asm_id: int, user_ids: List[int], questions: List[Dict[str, Any]]
    ):
        """Generates AI reworded questions and shuffled options for anti-cheating."""
        system_prompt = """You are an expert assessment anti-cheating AI.
For the given list of assessment questions:
1. Reword each question text with clear, distinct phrasing while maintaining the exact same concept, meaning, and difficulty.
2. For MCQ and MCQ Multi questions, preserve all valid option texts and randomize/shuffle the options list. Ensure correct_answer strictly matches the text of the correct option.
3. For coding questions, keep test cases and starter code functionally identical, but adjust problem context/description variables if appropriate.
4. Maintain all metadata fields for each question: id, question_type, marks, section_id, difficulty, programming_language, test_cases.
5. Respond ONLY with valid JSON in this exact structure:
{"questions": [ ...reworded questions with identical structure... ]}"""

        for user_id in user_ids:
            try:
                # Prepare a sanitized version of questions for the prompt
                prompt = (
                    f"Generate unique AI variants for user {user_id}. Base questions:\n"
                    f"{json.dumps(questions, default=str)}"
                )
                result = await self.ai.ai.generate_json(prompt, system_prompt)
                variant_questions = result.get("questions")

                if isinstance(variant_questions, list) and len(variant_questions) == len(questions):
                    # Ensure question IDs, section IDs, and critical metadata are strictly preserved
                    for i, vq in enumerate(variant_questions):
                        orig_q = questions[i]
                        vq["id"] = orig_q.get("id", vq.get("id"))
                        vq["marks"] = orig_q.get("marks", vq.get("marks", 1.0))
                        vq["section_id"] = orig_q.get("section_id", vq.get("section_id"))
                        vq["question_type"] = orig_q.get("question_type", vq.get("question_type"))
                        if orig_q.get("test_cases") and not vq.get("test_cases"):
                            vq["test_cases"] = orig_q["test_cases"]
                        if orig_q.get("programming_language") and not vq.get("programming_language"):
                            vq["programming_language"] = orig_q["programming_language"]

                    self.repo.update_custom_questions(asm_id, user_id, variant_questions)
                    logger.info(f"Successfully generated AI variants for asm {asm_id}, user {user_id}")
                else:
                    logger.warning(f"AI variant result format unexpected for user {user_id}, using local shuffle")
                    fallback_shuffled = self._shuffle_questions_for_user(questions)
                    self.repo.update_custom_questions(asm_id, user_id, fallback_shuffled)
            except Exception as e:
                logger.error(f"Variant generation failed for user {user_id}: {e}, using local shuffle")
                try:
                    fallback_shuffled = self._shuffle_questions_for_user(questions)
                    self.repo.update_custom_questions(asm_id, user_id, fallback_shuffled)
                except Exception as ex2:
                    logger.error(f"Fallback shuffle also failed for user {user_id}: {ex2}")

    def start_session(self, asm_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Start or resume a session. Returns session metadata dict or None if not assigned.
        On a fresh start: stamps started_at, sets status='in_progress'.
        On a resume: increments resume_count only.
        """
        return self.repo.start_session(asm_id, user_id)

    def record_strike(
        self,
        asm_id: int,
        user_id: int,
        violation_name: str = "proctoring_violation",
        flag_type: str = "proctoring_violation",
        is_terminal: bool = False,
    ) -> Dict[str, Any]:
        """Record a proctoring strike and persist the violation reason."""
        return self.repo.record_strike(
            asm_id=asm_id,
            user_id=user_id,
            violation_name=violation_name,
            flag_type=flag_type,
            is_terminal=is_terminal,
        )
