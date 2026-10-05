"""
Verify Module — Assignment API
================================
Handles assigning assessments to users and listing candidates.
Prefix: /api/verify/assignments
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from backend.modules.verify.services.assignment_service import AssignmentService
from backend.modules.verify.api.live_monitoring import notify_live_monitor

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AssignRequest(BaseModel):
    user_ids: List[int]
    deadline: Optional[str] = None          # ISO date string
    generate_variants: bool = False
    question_ids: Optional[List[int]] = None # Optional subset of questions to assign
    shuffle_questions: bool = False         # Whether to shuffle per user
    proctoring_strictness: Optional[str] = None # 'lenient', 'balanced', 'strict'
    proctoring_config: Optional[Dict[str, Any]] = None # Custom proctoring config dict

class RecordStrikeRequest(BaseModel):
    violation_name: str = "proctoring_violation"
    flag_type: str = "proctoring_violation"
    is_terminal: bool = False   # True when MAX_STRIKES is reached on the client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/assignments", tags=["Verify - Assignments"])

def get_assignment_service(current_user: dict = Depends(get_current_user)) -> AssignmentService:
    return AssignmentService(tenant_id=current_user.get("tenant_id", "public"))

# ---------------------------------------------------------------------------
# 1. GET /my-tests — list assessments assigned to current user
# ---------------------------------------------------------------------------

@router.get("/my-tests")
def list_my_tests(
    current_user: dict = Depends(get_current_user),
    service: AssignmentService = Depends(get_assignment_service),
):
    """List all assessments assigned to the logged-in user."""
    rows = service.get_user_assignments(current_user["id"])
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 1.5 GET /assignable-users — list users that can be assigned tests
# ---------------------------------------------------------------------------

@router.get("/assignable-users")
def list_assignable_users(
    assessment_id: Optional[int] = None,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_ASSIGN)),
    service: AssignmentService = Depends(get_assignment_service),
):
    """List all active non-candidate users in the tenant, optionally annotated with assignment status for assessment_id."""
    rows = service.get_assignable_users(assessment_id=assessment_id)
    return {"success": True, "data": rows}

@router.get("/recent")
def list_recent_assignments(
    limit: int = 10,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_ASSIGN)),
    service: AssignmentService = Depends(get_assignment_service),
):
    """List recent assignments across the org."""
    rows = service.get_recent_assignments(limit)
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 2. POST /{asm_id}/assign — bulk assign users to an assessment
# ---------------------------------------------------------------------------

@router.post("/{asm_id}/assign")
async def assign_assessment(
    asm_id: int,
    body: AssignRequest,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_ASSIGN)),
    service: AssignmentService = Depends(get_assignment_service),
):
    """Bulk-assign users to an assessment. Optionally generates AI variants and customizes proctoring."""
    try:
        assigned_count = await service.assign_assessment(
            asm_id=asm_id,
            user_ids=body.user_ids,
            assigned_by=current_user["id"],
            deadline=body.deadline,
            generate_variants=body.generate_variants,
            question_ids=body.question_ids,
            shuffle_questions=body.shuffle_questions,
            proctoring_strictness=body.proctoring_strictness,
            proctoring_config=body.proctoring_config,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to assign assessment %s: %s", asm_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while assigning the assessment. Please try again.")

    return {
        "success": True,
        "data": {"assigned": assigned_count, "total_requested": len(body.user_ids)},
        "message": f"Assessment assigned to {len(body.user_ids)} user(s)",
    }

# ---------------------------------------------------------------------------
# 3. GET /{asm_id}/candidates — list assigned candidates with status
# ---------------------------------------------------------------------------

@router.get("/{asm_id}/candidates")
def list_candidates(
    asm_id: int,
    current_user: dict = Depends(require_permission(P.VERIFY_ASSESS_ASSIGN)),
    service: AssignmentService = Depends(get_assignment_service),
):
    """List all users assigned to an assessment along with their status."""
    rows = service.get_assignment_candidates(asm_id)
    return {"success": True, "data": rows}

# ---------------------------------------------------------------------------
# 4. POST /{asm_id}/start-session — mark assessment as started (or resumed)
# ---------------------------------------------------------------------------

@router.post("/{asm_id}/start-session")
async def start_assessment_session(
    asm_id: int,
    current_user: dict = Depends(get_current_user),
    service: AssignmentService = Depends(get_assignment_service),
):
    """
    Mark the assessment as started. If already started (resume scenario),
    increments resume_count and returns session state without resetting the timer.
    """
    result = service.start_session(asm_id, current_user["id"])
    if result is None:
        raise HTTPException(status_code=400, detail="Cannot start session. It may not be assigned to you.")

    # Broadcast to HR live monitor
    asyncio.create_task(notify_live_monitor(asm_id, "session_started", current_user["id"]))

    return {"success": True, "data": result, "message": "Session started"}

# ---------------------------------------------------------------------------
# 5. POST /{asm_id}/record-strike — increment strike count + log violation reason
# ---------------------------------------------------------------------------

@router.post("/{asm_id}/record-strike")
async def record_proctoring_strike(
    asm_id: int,
    body: RecordStrikeRequest,
    current_user: dict = Depends(get_current_user),
    service: AssignmentService = Depends(get_assignment_service),
):
    """
    Increment strike count and persist the violation reason to proctoring_strikes.
    Will terminate the assignment if is_terminal=True.
    """
    result = service.record_strike(
        asm_id=asm_id,
        user_id=current_user["id"],
        violation_name=body.violation_name,
        flag_type=body.flag_type,
        is_terminal=body.is_terminal,
    )

    # Broadcast to HR live monitor
    asyncio.create_task(notify_live_monitor(asm_id, "strike_recorded", current_user["id"], result))

    return {"success": True, "data": result, "message": "Strike recorded"}