"""
Verify Module — Assessment Builder API
========================================
Handles creation, editing, and management of assessment templates.
Prefix: /api/verify/builder
"""

import json
import logging
import os
import uuid
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Body
from pydantic import BaseModel, ConfigDict, field_validator

from backend.core.database import DATA_DIR
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from backend.common.services.ai.agents import AIAgents
from backend.modules.verify.services.assessment_service import AssessmentService
from backend.modules.verify.services.submission_service import SubmissionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/builder", tags=["Verify - Builder"])

def get_submission_service(current_user: dict = Depends(get_current_user)) -> SubmissionService:
    return SubmissionService(tenant_id=current_user.get("tenant_id", "public"))

# ---------------------------------------------------------------------------
# Optional S3 support
# ---------------------------------------------------------------------------
try:
    from backend.common.utils.s3_utils import upload_to_s3
    _HAS_S3 = True
except ImportError:
    _HAS_S3 = False

# ---------------------------------------------------------------------------
# LeetCode import helpers
# ---------------------------------------------------------------------------
LEETCODE_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com/",
}

async def _fetch_leetcode(title_slug: str) -> dict:
    import httpx
    import re
    query = """query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
            title content topicTags { name }
            codeSnippets { langSlug code }
            exampleTestcases sampleTestCase
        }
    }"""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        resp = await client.post(
            "https://leetcode.com/graphql",
            json={"operationName": "questionData", "variables": {"titleSlug": title_slug}, "query": query},
            headers=LEETCODE_HEADERS,
        )
        if resp.status_code != 200:
            return {}
        return resp.json().get("data", {}).get("question", {}) or {}

def get_assessment_service(current_user: dict = Depends(get_current_user)) -> AssessmentService:
    return AssessmentService(tenant_id=current_user.get("tenant_id", "public"))

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class QuestionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    question_text: str
    question_type: str = "mcq"  # mcq | mcq_multi | coding | written | file_upload | fill_in
    options: List[Any] = []
    correct_answer: Optional[str] = None
    model_answer: Optional[str] = None
    starter_code: Optional[str] = None
    test_cases: List[Dict[str, Any]] = []
    programming_language: Optional[str] = None
    accepted_file_types: Optional[str] = None
    skill_id: Optional[int] = None
    marks: float = 1.0
    order_index: int = 0
    images: List[str] = []
    tags: List[str] = []
    section_id: Optional[str] = None
    difficulty: Optional[str] = "medium"

    @field_validator("options", "test_cases", "tags", "images", mode="before")
    def parse_json_lists(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        if v is None:
            return []
        return v

    @field_validator("skill_id", mode="before")
    def parse_skill_id(cls, v):
        if v == "" or v is None:
            return None
        return int(v)

    @field_validator("marks", mode="before")
    def parse_marks(cls, v):
        if v == "" or v is None:
            return 1.0
        return float(v)


class SectionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str           # client-generated e.g. "sec_1"
    title: str
    instructions: Optional[str] = None
    time_limit_minutes: Optional[int] = None

    @field_validator("time_limit_minutes", mode="before")
    def parse_section_time_limit(cls, v):
        if v == "" or v is None:
            return None
        return int(v)


class AssessmentCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    description: Optional[str] = None
    type: str = "mcq"  # mcq | coding | written | mixed
    time_limit_minutes: Optional[int] = None
    pass_score: float = 70.0
    shuffle_questions: bool = False
    show_result_immediately: bool = True
    questions: List[QuestionIn] = []
    sections: List[SectionIn] = []

    @field_validator("time_limit_minutes", mode="before")
    def parse_time_limit(cls, v):
        if v == "" or v is None:
            return None
        return int(v)

    @field_validator("pass_score", mode="before")
    def parse_pass_score(cls, v):
        if v == "" or v is None:
            return 70.0
        return float(v)


class AssessmentUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    pass_score: Optional[float] = None
    shuffle_questions: Optional[bool] = None
    show_result_immediately: Optional[bool] = None
    sections: Optional[List[SectionIn]] = None
    questions: Optional[List[QuestionIn]] = None

    @field_validator("time_limit_minutes", mode="before")
    def parse_time_limit(cls, v):
        if v == "" or v is None:
            return None
        return int(v)

    @field_validator("pass_score", mode="before")
    def parse_pass_score(cls, v):
        if v == "" or v is None:
            return None
        return float(v)


class StatusUpdate(BaseModel):
    status: str  # draft | active | inactive | closed


class ImportURLBody(BaseModel):
    url: str


class AIGenerateCodeBody(BaseModel):
    question_text: str
    difficulty: str = "medium"  # easy | medium | hard


class RandomizeBody(BaseModel):
    questions: List[Dict[str, Any]]

# ---------------------------------------------------------------------------
# 1. POST /assessments — create assessment + questions
# ---------------------------------------------------------------------------

@router.post("/assessments")
async def create_assessment(
    body: AssessmentCreate,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_MANAGE)),
    service: AssessmentService = Depends(get_assessment_service)
):
    """Create a new assessment template with questions."""
    for q in body.questions:
        if q.question_type == "coding":
            valid_tc = [tc for tc in q.test_cases if tc.get("expected_output") is not None]
            if len(valid_tc) < 3:
                raise HTTPException(
                    status_code=422,
                    detail=f"Coding question '{q.question_text[:60]}' requires at least 3 test cases with expected_output.",
                )

    data = body.dict()
    data["created_by"] = current_user["id"]
    data["org_id"] = current_user.get("org_id")
    
    try:
        asm_id = service.create_assessment(data)
        return {"success": True, "data": {"id": asm_id}, "message": "Assessment created successfully"}
    except Exception as e:
        logger.exception("Failed to create assessment: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while creating the assessment. Please try again.")

@router.get("/assessments/{asm_id}/stats")
def get_assessment_stats(
    asm_id: int,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_MANAGE)),
    sub_service: SubmissionService = Depends(get_submission_service)
):
    """Get analytics for a specific assessment."""
    stats = sub_service.get_assessment_analytics(asm_id)
    return {"success": True, "data": stats}

# ---------------------------------------------------------------------------
# Proctoring Settings — GET and PUT global defaults stored in tenants.settings
# ---------------------------------------------------------------------------

class ProctoringDefaultsBody(BaseModel):
    proctoring_defaults: Dict[str, Any]

@router.get("/proctoring-settings")
def get_proctoring_settings(
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_MANAGE)),
):
    """Return the tenant's global proctoring defaults."""
    from backend.core.database import get_db_connection
    from psycopg2.extras import RealDictCursor
    tenant_id = current_user.get("tenant_id", "public")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT settings FROM public.tenants WHERE id = %s", (tenant_id,))
            row = cur.fetchone()
            settings = dict(row["settings"]) if row and row["settings"] else {}
    finally:
        conn.close()
    return {"success": True, "data": {"proctoring_defaults": settings.get("proctoring_defaults", {})}}

@router.put("/proctoring-settings")
def update_proctoring_settings(
    body: ProctoringDefaultsBody,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_MANAGE)),
):
    """Persist the tenant's global proctoring defaults."""
    from backend.core.database import get_db_connection
    from psycopg2.extras import RealDictCursor
    import json as _json
    tenant_id = current_user.get("tenant_id", "public")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Read existing settings first so we don't overwrite unrelated keys
            cur.execute("SELECT settings FROM public.tenants WHERE id = %s", (tenant_id,))
            row = cur.fetchone()
            settings = dict(row["settings"]) if row and row["settings"] else {}
            settings["proctoring_defaults"] = body.proctoring_defaults
            cur.execute(
                "UPDATE public.tenants SET settings = %s WHERE id = %s",
                (_json.dumps(settings), tenant_id)
            )
        conn.commit()
    finally:
        conn.close()
    return {"success": True, "message": "Proctoring settings saved."}



@router.get("/assessments")
def list_assessments(
    current_user: dict = Depends(require_permission("verify.assessments.view")),
    service: AssessmentService = Depends(get_assessment_service),
):
    """List all active assessments for this tenant with question counts."""
    rows = service.get_all_assessments()
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 3. GET /assessments/{asm_id} — full assessment with questions
# ---------------------------------------------------------------------------

@router.get("/assessments/{asm_id}")
def get_assessment(
    asm_id: int,
    current_user: dict = Depends(get_current_user),
    service: AssessmentService = Depends(get_assessment_service),
):
    asm = service.get_assessment(asm_id)
    if not asm:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Merge current user's assignment state so the frontend can restore proctoring
    # state (strikes, timer, config) without a separate API call.
    try:
        from backend.core.database import get_db_connection
        from psycopg2.extras import RealDictCursor
        from datetime import datetime, timezone

        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SET search_path TO "{current_user.get("tenant_id", "public")}"')
            cur.execute(
                """
                SELECT aa.id AS assignment_id, aa.strike_count, aa.terminated_by_proctor,
                       aa.proctoring_config, aa.started_at, aa.status, aa.custom_questions
                FROM assessment_assignments aa
                WHERE aa.assessment_id = %s AND aa.user_id = %s
                LIMIT 1
                """,
                (asm_id, current_user["id"])
            )
            row = cur.fetchone()
        conn.close()

        if row:
            started_at = row['started_at']
            session_already_started = started_at is not None

            time_remaining = None
            limit_mins = int(asm['time_limit_minutes']) if asm.get('time_limit_minutes') else None
            if session_already_started and limit_mins and started_at:
                now = datetime.now(timezone.utc)
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                elapsed = (now - started_at).total_seconds()
                time_remaining = max(0, int(limit_mins * 60 - elapsed))

            # Apply candidate-specific custom questions (variants / shuffle / subset) if present
            custom_qs = row.get('custom_questions')
            if custom_qs:
                if isinstance(custom_qs, str):
                    try:
                        custom_qs = json.loads(custom_qs)
                    except Exception:
                        custom_qs = None
                if isinstance(custom_qs, list) and len(custom_qs) > 0:
                    asm['questions'] = custom_qs

            asm.update({
                "assignment_id": row['assignment_id'],
                "strike_count": row['strike_count'] or 0,
                "terminated_by_proctor": row['terminated_by_proctor'] or False,
                "proctoring_config": row['proctoring_config'],
                "session_already_started": session_already_started,
                "time_remaining_seconds": time_remaining,
            })
    except Exception as e:
        logger.warning("Could not fetch assignment state for assessment %s: %s", asm_id, e)

    return {"success": True, "data": asm}

# ---------------------------------------------------------------------------
# 4. PUT /assessments/{asm_id} — update metadata only
# ---------------------------------------------------------------------------

@router.put("/assessments/{asm_id}")
def update_assessment(
    asm_id: int,
    body: AssessmentUpdate,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_MANAGE)),
    service: AssessmentService = Depends(get_assessment_service),
):
    import json as _json
    from backend.core.database import get_db_connection

    # Scalar fields that map directly to the assessments table
    SCALAR_FIELDS = {"title", "description", "type", "time_limit_minutes", "pass_score",
                     "shuffle_questions", "show_result_immediately"}

    updates: Dict[str, Any] = {}
    body_data = body.dict(exclude_unset=True)

    for k, v in body_data.items():
        if k in SCALAR_FIELDS and v is not None:
            updates[k] = v

    if "sections" in body_data and body_data["sections"] is not None:
        updates["sections"] = _json.dumps([s if isinstance(s, dict) else s.dict() for s in body_data["sections"]])

    tenant_id = current_user.get("tenant_id", "public")
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')

            # Update scalar columns if any
            if updates:
                set_clauses = ", ".join(f"{k} = %s" for k in updates)
                values = list(updates.values()) + [asm_id]
                cur.execute(
                    f"UPDATE assessments SET {set_clauses}, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND is_deleted = FALSE",
                    values,
                )

            # Full question replacement when questions list is provided
            if "questions" in body_data and body_data["questions"] is not None:
                cur.execute("DELETE FROM assessment_questions WHERE assessment_id = %s", (asm_id,))
                for q in body_data["questions"]:
                    qd = q if isinstance(q, dict) else q.dict()
                    cur.execute('''
                        INSERT INTO assessment_questions
                        (assessment_id, question_text, question_type, options, correct_answer,
                         model_answer, starter_code, test_cases, programming_language,
                         accepted_file_types, skill_id, marks, order_index, tags, images,
                         section_id, difficulty)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ''', (
                        asm_id,
                        qd.get("question_text"),
                        qd.get("question_type"),
                        _json.dumps(qd.get("options", [])),
                        qd.get("correct_answer"),
                        qd.get("model_answer"),
                        qd.get("starter_code"),
                        _json.dumps(qd.get("test_cases", [])),
                        qd.get("programming_language"),
                        qd.get("accepted_file_types"),
                        qd.get("skill_id"),
                        qd.get("marks", 1.0),
                        qd.get("order_index", 0),
                        _json.dumps(qd.get("tags", [])),
                        _json.dumps(qd.get("images", [])),
                        qd.get("section_id"),
                        qd.get("difficulty", "medium"),
                    ))

        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.exception("Failed to update assessment %s: %s", asm_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while updating the assessment.")
    finally:
        conn.close()

    return {"success": True, "message": "Assessment updated"}



# ---------------------------------------------------------------------------
# 5. DELETE /assessments/{asm_id} — soft delete
# ---------------------------------------------------------------------------

@router.delete("/assessments/{asm_id}")
def delete_assessment(
    asm_id: int,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_MANAGE)),
    service: AssessmentService = Depends(get_assessment_service),
):
    try:
        success = service.delete_assessment(asm_id)
        if not success:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return {"success": True, "message": "Assessment deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete assessment %s: %s", asm_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while deleting the assessment. Please try again.")

# ---------------------------------------------------------------------------
# 6. PATCH /assessments/{asm_id}/status — update status
# ---------------------------------------------------------------------------

@router.patch("/assessments/{asm_id}/status")
def update_status(
    asm_id: int,
    body: StatusUpdate,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_MANAGE)),
    service: AssessmentService = Depends(get_assessment_service),
):
    allowed = {"draft", "active", "inactive", "closed"}
    if body.status not in allowed:
        raise HTTPException(status_code=422, detail=f"Status must be one of {allowed}")

    try:
        success = service.update_status(asm_id, body.status)
        if not success:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return {"success": True, "message": f"Status set to {body.status}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update status for assessment %s: %s", asm_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while updating the assessment status. Please try again.")

# ---------------------------------------------------------------------------
# 7. POST /assessments/{asm_id}/publish — set status=active
# ---------------------------------------------------------------------------

@router.post("/assessments/{asm_id}/publish")
def publish_assessment(
    asm_id: int,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_MANAGE)),
    service: AssessmentService = Depends(get_assessment_service),
):
    try:
        success = service.publish_assessment(asm_id)
        if not success:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return {"success": True, "message": "Assessment published"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to publish assessment %s: %s", asm_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while publishing the assessment. Please try again.")

# ---------------------------------------------------------------------------
# 8. POST /import-questions — upload PDF/DOCX/TXT, AI-parse questions
# ---------------------------------------------------------------------------

@router.post("/import-questions")
async def import_questions(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
):
    """Upload a file (PDF/DOCX/TXT) and AI-parse into structured questions."""
    content_type = file.content_type or ""
    filename = file.filename or ""
    raw_bytes = await file.read()

    text = ""
    try:
        if filename.lower().endswith(".pdf") or "pdf" in content_type:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=raw_bytes, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
        else:
            # DOCX or plain text — try utf-8, fall back to latin-1
            try:
                text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = raw_bytes.decode("latin-1")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract text from file: {e}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No readable text found in the uploaded file.")

    # AI parse
    ai = AIAgents()
    system_prompt = """You are a question-extraction AI. Parse the text and return a list of structured questions.
Respond ONLY with valid JSON: {"questions": [{"question_text": "", "question_type": "mcq|written|coding", "options": [], "correct_answer": "", "marks": 1}]}"""
    prompt = f"Extract all questions from the following text:\n\n{text[:12000]}"
    result = await ai.ai.generate_json(prompt, system_prompt)
    questions = result.get("questions", [])

    return {"success": True, "data": questions, "message": f"{len(questions)} question(s) parsed"}

# ---------------------------------------------------------------------------
# 9. POST /import-url — import from URL (LeetCode or generic)
# ---------------------------------------------------------------------------

@router.post("/import-url")
async def import_from_url(
    body: ImportURLBody,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
):
    """Import question(s) from a URL. Supports LeetCode and general web pages."""
    import re
    import httpx

    url = body.url.strip()
    questions: List[Dict[str, Any]] = []

    # --- LeetCode ---
    lc_match = re.search(r"leetcode\.com/problems/([^/]+)", url)
    if lc_match:
        title_slug = lc_match.group(1)
        qdata = await _fetch_leetcode(title_slug)
        if not qdata:
            raise HTTPException(status_code=502, detail="Could not fetch problem from LeetCode")

        # Convert HTML to Markdown
        text = qdata.get("content", "") or ""
        text = re.sub(r'<strong>(.*?)</strong>', r'**\1**', text, flags=re.DOTALL)
        text = re.sub(r'<b>(.*?)</b>', r'**\1**', text, flags=re.DOTALL)
        text = re.sub(r'<em>(.*?)</em>', r'*\1*', text, flags=re.DOTALL)
        text = re.sub(r'<i>(.*?)</i>', r'*\1*', text, flags=re.DOTALL)
        text = re.sub(r'<code>(.*?)</code>', r'`\1`', text, flags=re.DOTALL)
        text = re.sub(r'<pre>(.*?)</pre>', r'```\n\1\n```', text, flags=re.DOTALL)
        text = re.sub(r'<ul>', r'', text)
        text = re.sub(r'</ul>', r'', text)
        text = re.sub(r'<li>(.*?)</li>', r'- \1\n', text, flags=re.DOTALL)
        text = re.sub(r'<p>(.*?)</p>', r'\1\n\n', text, flags=re.DOTALL)
        text = re.sub(r'<sup>(.*?)</sup>', r'^\1', text, flags=re.DOTALL)
        text = re.sub(r'<sub>(.*?)</sub>', r'_\1', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', '', text)  # strip remaining tags BEFORE unescaping
        text = text.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'")
        content_text = text.strip()

        # Grab Python starter code
        starter_code = ""
        for snippet in qdata.get("codeSnippets", []):
            if snippet.get("langSlug") == "python3":
                starter_code = snippet.get("code", "")
                break
        if not starter_code:
            snippets = qdata.get("codeSnippets", [])
            if snippets:
                starter_code = snippets[0].get("code", "")

        # Build test cases from the Markdown content (Example blocks)
        tc_matches = re.findall(r'\*\*Input:\*\*(.*?)\n\*\*Output:\*\*(.*?)(?=\n|$)', content_text, re.IGNORECASE)
        test_cases = []
        for inp, out in tc_matches:
            test_cases.append({
                "input": inp.strip(),
                "expected_output": out.strip()
            })
        
        while len(test_cases) < 3:
            test_cases.append({"input": "", "expected_output": ""})

        questions.append({
            "question_text": f"{qdata.get('title', title_slug)}\n\n{content_text[:3000]}",
            "question_type": "coding",
            "options": [],
            "correct_answer": None,
            "starter_code": starter_code,
            "test_cases": test_cases,
            "programming_language": "python",
            "marks": 10,
        })
    else:
        # Generic URL: scrape + AI-parse
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                resp.raise_for_status()
                html = resp.text
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not fetch URL: {e}")

        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            page_text = soup.get_text(separator="\n")
        except Exception:
            page_text = re.sub(r"<[^>]+>", "", html)

        ai = AIAgents()
        system_prompt = """You are a question-extraction AI. Parse text scraped from a web page and extract assessment questions.
Respond ONLY with valid JSON: {"questions": [{"question_text": "", "question_type": "mcq|written|coding", "options": [], "correct_answer": "", "marks": 1}]}"""
        prompt = f"Extract questions from this webpage content:\n\n{page_text[:10000]}"
        result = await ai.ai.generate_json(prompt, system_prompt)
        questions = result.get("questions", [])

    return {"success": True, "data": questions, "message": f"{len(questions)} question(s) imported"}

# ---------------------------------------------------------------------------
# 10. POST /questions/upload-image — upload question image
# ---------------------------------------------------------------------------

@router.post("/questions/upload-image")
async def upload_question_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
):
    """Upload an image for a question. Tries S3 first, falls back to local."""
    raw = await file.read()
    ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"

    if _HAS_S3:
        try:
            image_url = upload_to_s3(raw, f"uploads/questions/{filename}", content_type=file.content_type)
            return {"success": True, "data": {"image_url": image_url}}
        except Exception as e:
            logger.warning(f"S3 upload failed, falling back to local: {e}")

    # Local fallback
    save_dir = os.path.join(DATA_DIR, "uploads", "questions")
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, filename)
    with open(save_path, "wb") as f:
        f.write(raw)

    image_url = f"/uploads/questions/{filename}"
    return {"success": True, "data": {"image_url": image_url}}

# ---------------------------------------------------------------------------
# 11. POST /ai-generate-code — AI-generate coding question metadata
# ---------------------------------------------------------------------------

@router.post("/ai-generate-code")
async def ai_generate_code(
    body: AIGenerateCodeBody,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
):
    """Use AI to generate starter code, test cases, and language for a coding question."""
    ai = AIAgents()
    system_prompt = """You are an expert technical interviewer. Generate coding question metadata.
Respond ONLY with valid JSON matching this exact structure:
{
  "starter_code": "def solution():\\n    pass",
  "test_cases": [
    {"input": "...", "expected_output": "..."},
    {"input": "...", "expected_output": "..."},
    {"input": "...", "expected_output": "..."}
  ],
  "programming_language": "python"
}"""
    prompt = f"Generate {body.difficulty} coding question metadata for: {body.question_text}"
    result = await ai.ai.generate_json(prompt, system_prompt)

    # Ensure at least 3 test cases
    tcs = result.get("test_cases", [])
    while len(tcs) < 3:
        tcs.append({"input": "", "expected_output": ""})
    result["test_cases"] = tcs

    return {"success": True, "data": result}

# ---------------------------------------------------------------------------
# 12. POST /randomize-assessment — AI-randomize questions to prevent cheating
# ---------------------------------------------------------------------------

@router.post("/randomize-assessment")
async def randomize_assessment(
    body: RandomizeBody,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
):
    """Use AI to reword questions and shuffle MCQ options to prevent cheating."""
    if not body.questions:
        return {"success": True, "data": [], "message": "No questions to randomize"}

    ai = AIAgents()
    system_prompt = """You are an assessment anti-cheating AI. Rewrite each question with different wording (same concept and difficulty).
For MCQ questions, also shuffle the options (keep correct_answer pointing to the correct content, not index).
Respond ONLY with valid JSON: {"questions": [ ...same structure but reworded... ]}"""
    prompt = f"Randomize these assessment questions:\n\n{json.dumps(body.questions, default=str)}"
    result = await ai.ai.generate_json(prompt, system_prompt)

    randomized = result.get("questions", body.questions)
    return {"success": True, "data": randomized, "message": f"{len(randomized)} question(s) randomized"}
