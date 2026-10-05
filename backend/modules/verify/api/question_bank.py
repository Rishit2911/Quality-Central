"""
Verify Module — Question Bank API
=================================
Handles CRUD for reusable questions and AI extraction.
Prefix: /api/verify/question-bank
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from backend.modules.verify.services.question_bank_service import QuestionBankService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/question-bank", tags=["Verify - Question Bank"])

def get_qb_service(current_user: dict = Depends(get_current_user)) -> QuestionBankService:
    return QuestionBankService(tenant_id=current_user.get("tenant_id", "public"))

class QuestionCreate(BaseModel):
    question_text: str
    question_type: str = "mcq"
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    model_answer: Optional[str] = None
    starter_code: Optional[str] = None
    test_cases: Optional[List[Dict[str, Any]]] = None
    programming_language: Optional[str] = None
    accepted_file_types: Optional[str] = None
    marks: float = 1.0
    tags: Optional[List[str]] = None
    images: Optional[List[str]] = None
    topic: Optional[str] = None

@router.post("")
def create_question(
    body: QuestionCreate,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
    service: QuestionBankService = Depends(get_qb_service)
):
    try:
        data = body.dict()
        data["created_by"] = current_user["id"]
        q_id = service.create_question(data)
        return {"success": True, "data": {"id": q_id}, "message": "Question added to bank"}
    except Exception as e:
        logger.exception("Failed to create question: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while saving the question. Please try again.")

@router.get("")
def list_questions(
    tags: Optional[str] = None,
    q_type: Optional[str] = None,
    topic: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_VIEW)),
    service: QuestionBankService = Depends(get_qb_service)
):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    rows = service.list_questions(tags=tag_list, q_type=q_type, topic=topic, search=search)
    return {"success": True, "data": rows}

@router.get("/{q_id}")
def get_question(
    q_id: int,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_VIEW)),
    service: QuestionBankService = Depends(get_qb_service)
):
    q = service.get_question_by_id(q_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"success": True, "data": q}

@router.put("/{q_id}")
def update_question(
    q_id: int,
    body: QuestionCreate,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
    service: QuestionBankService = Depends(get_qb_service)
):
    success = service.update_question(q_id, body.dict())
    if not success:
        raise HTTPException(status_code=404, detail="Question not found or update failed")
    return {"success": True, "message": "Question updated successfully"}

@router.delete("/{q_id}")
def delete_question(
    q_id: int,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
    service: QuestionBankService = Depends(get_qb_service)
):
    success = service.delete_question(q_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"success": True, "message": "Question deleted"}

class URLImportRequest(BaseModel):
    url: str
    tags: Optional[List[str]] = None
    topic: Optional[str] = None

@router.post("/import-url")
async def import_url(
    body: URLImportRequest,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
    service: QuestionBankService = Depends(get_qb_service)
):
    """Extract questions from a URL (supports LeetCode, HackerRank, and generic pages).
    Returns extracted questions for review — does NOT save automatically."""
    import re, httpx
    url = body.url.strip()
    questions: List[Dict[str, Any]] = []

    # LeetCode direct API
    lc_match = re.search(r"leetcode\.com/problems/([^/]+)", url)
    if lc_match:
        title_slug = lc_match.group(1)
        query = """query questionData($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                title content difficulty
                codeSnippets { langSlug code }
                exampleTestcases sampleTestCase
            }
        }"""
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://leetcode.com/graphql",
                    json={"operationName": "questionData", "variables": {"titleSlug": title_slug}, "query": query},
                    headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"},
                )
                qdata = resp.json().get("data", {}).get("question", {}) or {}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not fetch from LeetCode: {e}")

        if not qdata:
            raise HTTPException(status_code=502, detail="LeetCode problem not found")

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

        starter_code = next(
            (s["code"] for s in qdata.get("codeSnippets", []) if s.get("langSlug") == "python3"),
            (qdata.get("codeSnippets") or [{}])[0].get("code", "")
        )
        
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

        questions = [{
            "question_text": f"{qdata.get('title', title_slug)}\n\n{content_text[:3000]}",
            "question_type": "coding",
            "options": [],
            "correct_answer": None,
            "starter_code": starter_code,
            "test_cases": test_cases,
            "programming_language": "python",
            "marks": 10,
            "tags": body.tags or [],
            "topic": body.topic,
            "difficulty": (qdata.get("difficulty") or "medium").lower(),
        }]
    else:
        # Generic URL scrape + AI
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

        from backend.common.services.ai.agents import AIAgents
        ai = AIAgents()
        system_prompt = """You are a question-extraction AI. Parse text scraped from a web page and extract assessment questions.
Respond ONLY with valid JSON: {"questions": [{"question_text": "", "question_type": "mcq|written|coding", "options": [], "correct_answer": "", "marks": 1}]}"""
        result = await ai.ai.generate_json(
            f"Extract questions from this webpage:\n\n{page_text[:10000]}", system_prompt
        )
        questions = result.get("questions", [])
        for q in questions:
            q["tags"] = body.tags or []
            q["topic"] = body.topic

    if not questions:
        raise HTTPException(status_code=422, detail="No questions could be extracted from that URL.")

    return {"success": True, "data": questions, "message": f"{len(questions)} question(s) extracted — review before saving."}


@router.post("/import-file")
async def import_questions_from_file(
    file: UploadFile = File(...),
    topic: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
    service: QuestionBankService = Depends(get_qb_service)
):
    """Extract questions from a file (PDF, Word, Excel, CSV) and return them for review.
    Does NOT save automatically — call /bulk after user approves."""
    content = await file.read()
    text = ""
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".pdf"):
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
        elif filename.endswith(".docx"):
            import docx, io
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join(p.text for p in doc.paragraphs)
        elif filename.endswith((".xlsx", ".xls")):
            import openpyxl, io
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            rows = []
            for row in ws.iter_rows(values_only=True):
                rows.append("\t".join(str(c) if c is not None else "" for c in row))
            text = "\n".join(rows)
        else:
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                text = content.decode("latin-1")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in this file.")

    from backend.common.services.ai.agents import AIAgents
    ai = AIAgents()
    system_prompt = """You are a question-extraction AI. Parse the text and return structured questions.
Respond ONLY with valid JSON: {"questions": [{"question_text": "", "question_type": "mcq|written|coding|fill_in", "options": [], "correct_answer": "", "marks": 1, "difficulty": "medium"}]}"""
    result = await ai.ai.generate_json(
        f"Extract all questions from the following text:\n\n{text[:12000]}", system_prompt
    )
    questions = result.get("questions", [])
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    for q in questions:
        q["tags"] = tag_list
        if topic:
            q["topic"] = topic

    if not questions:
        raise HTTPException(status_code=422, detail="AI could not extract any questions. Try a different file.")

    return {"success": True, "data": questions, "message": f"{len(questions)} question(s) extracted — review before saving."}


class BulkBankImport(BaseModel):
    items: List[Dict[str, Any]]

@router.post("/bulk")
def bulk_save_questions(
    body: BulkBankImport,
    current_user: dict = Depends(require_permission(P.VERIFY_QUESTIONS_MANAGE)),
    service: QuestionBankService = Depends(get_qb_service),
):
    """Save a batch of human-reviewed AI-extracted questions to the bank."""
    created_ids = []
    for item in body.items:
        item["created_by"] = current_user["id"]
        try:
            qid = service.create_question(item)
            created_ids.append(qid)
        except Exception as e:
            logger.warning("Skipping question due to error: %s", e)

    return {"success": True, "message": f"{len(created_ids)} question(s) saved to bank.", "ids": created_ids}

