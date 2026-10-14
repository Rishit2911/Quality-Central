from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from backend.modules.quality.services.chatbot_service import QualityChatbotService
from backend.core.error_logger import get_available_log_dates

router = APIRouter(prefix="/api/quality/chatbot", tags=["Quality AI Copilot"])

chatbot_service = QualityChatbotService()

class ChatQuerySchema(BaseModel):
    message: str = Field(..., min_length=1)
    user_name: Optional[str] = "User"
    bugs: Optional[List[Dict[str, Any]]] = None

class PrioritizeBugsSchema(BaseModel):
    developer_name: Optional[str] = "User"
    severity: Optional[str] = None
    bugs: Optional[List[Dict[str, Any]]] = None

class RCASchema(BaseModel):
    query: str
    date_str: Optional[str] = None
    error_id: Optional[str] = None
    raw_trace: Optional[str] = None

class DuplicateCheckSchema(BaseModel):
    title: str
    description: Optional[str] = ""
    module: Optional[str] = None

class HandoverSchema(BaseModel):
    bug_id: str
    developer_name: Optional[str] = "Developer"
    changes_summary: Optional[str] = ""

class SubmitDraftSchema(BaseModel):
    draft: Dict[str, Any]
    user_name: Optional[str] = "User"

@router.post("/chat")
def chat_copilot_endpoint(payload: ChatQuerySchema) -> Dict[str, Any]:
    """Conversational endpoint handling all Quality Central AI copilot queries."""
    res = chatbot_service.handle_chat_message(
        message=payload.message,
        user_name=payload.user_name or "User",
        client_bugs=payload.bugs
    )
    return {
        "success": True,
        **res
    }

@router.post("/submit-draft")
def submit_draft_endpoint(payload: SubmitDraftSchema) -> Dict[str, Any]:
    """Persists a structured bug report draft directly into quality_bugs database."""
    return chatbot_service.submit_bug_draft(
        draft=payload.draft,
        reporter_name=payload.user_name or "User"
    )

@router.post("/prioritize-bugs")
def direct_prioritize_endpoint(payload: PrioritizeBugsSchema) -> Dict[str, Any]:
    """Intelligently analyzes developer bugs and recommends the #1 bug to focus on with reasoning."""
    return chatbot_service.prioritize_developer_bugs(
        developer_name=payload.developer_name or "User",
        severity=payload.severity,
        client_bugs=payload.bugs
    )

@router.get("/logs/dates")
def get_log_dates_endpoint() -> Dict[str, Any]:
    """Returns available dates that contain server/terminal crash logs."""
    dates = get_available_log_dates()
    return {
        "success": True,
        "total": len(dates),
        "dates": dates
    }

@router.post("/rca")
def direct_rca_endpoint(payload: RCASchema) -> Dict[str, Any]:
    """Performs deep Root Cause Analysis on past or current server errors."""
    return chatbot_service.perform_rca(
        query=payload.query,
        date_str=payload.date_str,
        error_id=payload.error_id,
        raw_trace=payload.raw_trace
    )

@router.post("/check-duplicate")
def direct_duplicate_endpoint(payload: DuplicateCheckSchema) -> Dict[str, Any]:
    """Scans existing tickets to detect duplicate bug reports."""
    return chatbot_service.check_duplicate_bugs(
        title=payload.title,
        description=payload.description,
        module=payload.module
    )

@router.post("/draft-handover")
def direct_handover_endpoint(payload: HandoverSchema) -> Dict[str, Any]:
    """Drafts comprehensive QA handover notes for a resolved bug."""
    return chatbot_service.draft_handover_notes(
        bug_id=payload.bug_id,
        developer_name=payload.developer_name,
        changes_summary=payload.changes_summary
    )

@router.get("/developer-workload")
def get_developer_workload_endpoint(developer: Optional[str] = Query(None)) -> Dict[str, Any]:
    """Returns active workload, current active ticket, and progress for developers."""
    return chatbot_service.get_developer_workload_report(developer_name=developer)

@router.get("/project-releases")
def get_project_releases_endpoint(project: Optional[str] = Query(None)) -> Dict[str, Any]:
    """Returns latest releases, version tags, and last push dates for projects."""
    return chatbot_service.get_project_releases(project_name=project)

@router.get("/bug-lifecycle/{bug_id}")
def get_bug_lifecycle_endpoint(bug_id: str) -> Dict[str, Any]:
    """Returns bug age, turnaround time, assignment timeline, and audit history."""
    return chatbot_service.get_bug_lifecycle(bug_id_or_title=bug_id)
