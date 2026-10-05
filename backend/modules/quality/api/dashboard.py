import re
from datetime import datetime
import json
from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from pydantic import BaseModel, Field
from psycopg2.extras import RealDictCursor
from backend.core.auth import get_current_user
from backend.core.database import get_db_connection

router = APIRouter(prefix="/api/quality", tags=["Quality Central"])

def get_project_bug_prefix(project_name: str) -> str:
    clean = (project_name or "").strip().lower()
    if "talent" in clean or clean == "tc":
        return "TC"
    if "learning" in clean or clean == "lc":
        return "LC"
    if "assessment" in clean or clean == "ac":
        return "AC"
    if "employee" in clean or clean == "ec":
        return "EC"
    if "quality" in clean or clean == "qc":
        return "QC"
    if "lex" in clean:
        return "LEX"
    return "QC"

# ============================================================================
# DATABASE ACCESS HELPERS (PostgreSQL Persistence)
# ============================================================================

ALLOWED_CORE_PROJECTS = [
    "talent central",
    "learning central",
    "assessment central",
    "employee central",
    "quality central",
    "lexai"
]

def get_db_bugs(tenant_id: str = "public") -> List[Dict[str, Any]]:
    """Fetches all bug tickets from PostgreSQL, parsing JSON attachments."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute("""
                SELECT id, title, project, module, environment, priority, severity,
                       status, bug_type, assignee, reported_by, created_on,
                       steps_to_reproduce, expected_result, actual_result,
                       debugging_notes, verification_steps, tester, resolved_by,
                       resolved_at, handed_off_to_tester, removed_from_dev_list,
                       attachments, created_at, updated_at
                FROM quality_bugs
                ORDER BY created_at DESC, id DESC
            """)
            rows = cur.fetchall()
            bugs = []
            for r in rows:
                b = dict(r)
                if (b.get("project") or "").strip().lower() not in ALLOWED_CORE_PROJECTS:
                    continue
                att = b.get("attachments")
                if isinstance(att, str):
                    try:
                        b["attachments"] = json.loads(att)
                    except Exception:
                        b["attachments"] = []
                elif not att:
                    b["attachments"] = []
                bugs.append(b)
            return bugs
    except Exception as e:
        print(f"[QualityDB] Error fetching bugs: {e}")
        return []
    finally:
        conn.close()

def get_db_bug_by_id(bug_id: str, tenant_id: str = "public") -> Optional[Dict[str, Any]]:
    """Fetches a single bug ticket from PostgreSQL by ID."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute("""
                SELECT id, title, project, module, environment, priority, severity,
                       status, bug_type, assignee, reported_by, created_on,
                       steps_to_reproduce, expected_result, actual_result,
                       debugging_notes, verification_steps, tester, resolved_by,
                       resolved_at, handed_off_to_tester, removed_from_dev_list,
                       attachments, created_at, updated_at
                FROM quality_bugs
                WHERE LOWER(id) = LOWER(%s)
            """, (bug_id.strip(),))
            row = cur.fetchone()
            if not row:
                return None
            b = dict(row)
            att = b.get("attachments")
            if isinstance(att, str):
                try:
                    b["attachments"] = json.loads(att)
                except Exception:
                    b["attachments"] = []
            elif not att:
                b["attachments"] = []
            return b
    except Exception as e:
        print(f"[QualityDB] Error fetching bug {bug_id}: {e}")
        return None
    finally:
        conn.close()

def get_db_activities(tenant_id: str = "public", limit: int = 20) -> List[Dict[str, Any]]:
    """Fetches recent quality activity entries from PostgreSQL."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute("""
                SELECT id, user_name as user, avatar, timestamp, text
                FROM quality_activities
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"[QualityDB] Error fetching activities: {e}")
        return []
    finally:
        conn.close()

def add_db_activity(user_name: str, avatar: str, text: str, tenant_id: str = "public"):
    """Inserts a new activity record into PostgreSQL."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute("SELECT COUNT(*) FROM quality_activities")
            count = cur.fetchone()[0]
            act_id = f"ACT-{count + 1}"
            now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
            cur.execute("""
                INSERT INTO quality_activities (id, user_name, avatar, timestamp, text)
                VALUES (%s, %s, %s, %s, %s)
            """, (act_id, user_name, avatar, now_str, text))
            conn.commit()
    except Exception as e:
        print(f"[QualityDB] Error adding activity: {e}")
    finally:
        conn.close()

# ============================================================================
# SCHEMAS
# ============================================================================

class BugCreateSchema(BaseModel):
    title: str = Field(..., min_length=2)
    project: str = "Quality Central"
    module: str = "Authentication"
    environment: str = "Staging"
    severity: str = "Medium"
    priority: str = "P3 - Normal"
    bug_type: str = "Functional"
    assignee: str = "Rishit"
    steps_to_reproduce: Optional[str] = ""
    expected_result: Optional[str] = ""
    actual_result: Optional[str] = ""
    attachments: Optional[List[Dict[str, Any]]] = []

class BugUpdateSchema(BaseModel):
    title: Optional[str] = None
    project: Optional[str] = None
    module: Optional[str] = None
    environment: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    bug_type: Optional[str] = None
    assignee: Optional[str] = None
    steps_to_reproduce: Optional[str] = None
    expected_result: Optional[str] = None
    actual_result: Optional[str] = None
    debugging_notes: Optional[str] = None
    verification_steps: Optional[str] = None
    tester: Optional[str] = None

class SubmitDebugSchema(BaseModel):
    bug_ids: Optional[List[str]] = None
    tester: str = "Vidhi"
    debugging_notes: str
    verification_steps: Optional[str] = ""
    environment: Optional[str] = "Staging"
    remove_from_my_list: Optional[bool] = True

class ProjectCreateSchema(BaseModel):
    name: str = Field(..., min_length=2)
    prefix: str
    severity: str = "Normal"
    health_rate: Union[int, float] = 95
    status: str = "Active"
    lead: str = "Bhupesh"
    developers: Optional[List[str]] = []
    qa: Optional[List[str]] = []
    description: Optional[str] = ""

class ProjectUpdateSchema(BaseModel):
    name: Optional[str] = None
    prefix: Optional[str] = None
    severity: Optional[str] = None
    health_rate: Optional[Union[int, float]] = None
    status: Optional[str] = None
    lead: Optional[str] = None
    developers: Optional[List[str]] = None
    qa: Optional[List[str]] = None
    description: Optional[str] = None

# ============================================================================
# USER FILTER & METRIC COMPUTATION
# ============================================================================

def is_bug_assigned_to_user(bug: Dict[str, Any], user_identifier: Optional[str]) -> bool:
    if not user_identifier:
        return True
    assignee = (bug.get("assignee") or "").lower().strip()
    resolved_by = (bug.get("resolved_by") or "").lower().strip()
    u_clean = user_identifier.lower().strip()
    u_short = u_clean.split("@")[0].strip()
    
    # Check if 'rishit' matches in both
    if "rishit" in u_clean and (
        (assignee and "rishit" in assignee) or 
        (resolved_by and "rishit" in resolved_by)
    ):
        return True
        
    match_assignee = bool(
        assignee and (
            u_clean in assignee or assignee in u_clean or
            u_short in assignee or assignee in u_short
        )
    )
    match_resolved = bool(
        resolved_by and (
            u_clean in resolved_by or resolved_by in u_clean or
            u_short in resolved_by or resolved_by in u_short
        )
    )
    return match_assignee or match_resolved

def compute_dashboard_metrics(user_filter: Optional[str] = None, tenant_id: str = "public") -> Dict[str, Any]:
    """Dynamically calculates KPI counts, breakdowns, and widgets directly from PostgreSQL quality_bugs."""
    all_bugs = get_db_bugs(tenant_id=tenant_id)
    # Active bugs needing action (Open and In Progress)
    active_bugs = [
        b for b in all_bugs 
        if not (b.get("handed_off_to_tester") or b.get("removed_from_dev_list") or (b.get("status") or "").lower() in ("resolved", "closed"))
    ]
    if user_filter:
        active_pool = [b for b in active_bugs if is_bug_assigned_to_user(b, user_filter)]
        all_pool = [b for b in all_bugs if is_bug_assigned_to_user(b, user_filter)]
    else:
        active_pool = list(active_bugs)
        all_pool = list(all_bugs)

    total_active = len(active_pool)
    open_count = sum(1 for b in active_pool if (b.get("status") or "").lower() == "open")
    in_prog_count = sum(1 for b in active_pool if (b.get("status") or "").lower() == "in progress")
    
    # Resolved count preserves all completed tickets so resolved count never minuses
    resolved_count = sum(1 for b in all_pool if (b.get("status") or "").lower() == "resolved")
    closed_count = sum(1 for b in all_pool if (b.get("status") or "").lower() == "closed")
    solved_count = resolved_count + closed_count
    reopened_count = sum(1 for b in active_pool if (b.get("status") or "").lower() == "reopened")
    overdue_count = sum(1 for b in active_pool if b.get("overdue") is True)
    
    total_for_chart = total_active + solved_count
    def calc_pct(count: int, total_val: int) -> int:
        return int(round((count / total_val * 100))) if total_val > 0 else 0

    status_breakdown = [
        {"name": "Open", "value": open_count, "pct": calc_pct(open_count, total_for_chart), "color": "#3B82F6"},
        {"name": "In Progress", "value": in_prog_count, "pct": calc_pct(in_prog_count, total_for_chart), "color": "#F59E0B"},
        {"name": "Resolved", "value": solved_count, "pct": calc_pct(solved_count, total_for_chart), "color": "#10B981"},
        {"name": "Reopened", "value": reopened_count, "pct": calc_pct(reopened_count, total_for_chart), "color": "#EF4444"},
        {"name": "Closed", "value": closed_count, "pct": calc_pct(closed_count, total_for_chart), "color": "#06B6D4"}
    ]

    crit_count = sum(1 for b in active_pool if (b.get("severity") or "").lower() == "critical")
    high_count = sum(1 for b in active_pool if (b.get("severity") or "").lower() == "high")
    med_count = sum(1 for b in active_pool if (b.get("severity") or "").lower() == "medium")
    low_count = sum(1 for b in active_pool if (b.get("severity") or "").lower() == "low")

    bugs_by_severity = [
        {"severity": "Critical", "count": crit_count, "color": "#EF4444", "gradientId": "critGrad"},
        {"severity": "High", "count": high_count, "color": "#F97316", "gradientId": "highGrad"},
        {"severity": "Medium", "count": med_count, "color": "#3B82F6", "gradientId": "medGrad"},
        {"severity": "Low", "count": low_count, "color": "#10B981", "gradientId": "lowGrad"}
    ]

    action_items = [
        {
            "id": b["id"],
            "title": b["title"],
            "severity": b.get("severity", "Medium"),
            "assignee": b.get("assignee", "Unassigned"),
            "date": b.get("created_on", "Today"),
            "subtitle": f"{b.get('project', 'Quality Central')} • {b.get('module', 'General')}",
            "status": b.get("status", "Open"),
            "action": "Take action" if (b.get("status") or "").lower() == "open" else "Review"
        }
        for b in active_pool
        if (b.get("status") or "").lower() in ("open", "in progress")
    ]

    activities = get_db_activities(tenant_id=tenant_id, limit=20)

    return {
        "stats": {
            "new_bugs": open_count,
            "open_bugs": open_count,
            "in_progress": in_prog_count,
            "resolved_bugs": solved_count,
            "closed_bugs": closed_count,
            "solved_points": solved_count,
            "overdue_bugs": overdue_count
        },
        "status_overview": {
            "total": total_for_chart,
            "breakdown": status_breakdown
        },
        "bugs_by_severity": bugs_by_severity,
        "action_items": action_items,
        "recent_activity": activities
    }

# ============================================================================
# API ROUTES
# ============================================================================

@router.get("/dashboard")
def get_quality_dashboard(
    request: Request,
    scope: str = Query("personal"),
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Returns Quality Central dashboard metrics and operational widgets from PostgreSQL."""
    now_str = datetime.now().strftime("%I:%M %p")
    user_name = user.get("name") or user.get("username") or "Rishit"
    user_filter = user_name if scope == "personal" else None
    tenant_id = user.get("tenant_id") or "public"
    metrics = compute_dashboard_metrics(user_filter=user_filter, tenant_id=tenant_id)
    return {
        **metrics,
        "scope": scope,
        "synced_at": now_str,
        "user_context": {
            "email": user.get("username"),
            "name": user.get("name"),
            "role": user.get("role"),
            "employee_code": user.get("employee_code", "EMP0000")
        }
    }

@router.post("/refresh")
def refresh_quality_dashboard(
    request: Request,
    scope: str = Query("personal"),
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Triggers real-time refresh of quality metrics from PostgreSQL."""
    now_str = datetime.now().strftime("%I:%M %p")
    user_name = user.get("name") or user.get("username") or "Rishit"
    user_filter = user_name if scope == "personal" else None
    tenant_id = user.get("tenant_id") or "public"
    metrics = compute_dashboard_metrics(user_filter=user_filter, tenant_id=tenant_id)
    return {
        "success": True,
        "message": "Quality Central metrics refreshed successfully",
        "synced_at": now_str,
        "data": metrics
    }

@router.get("/bugs")
def get_bugs(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieves all bugs from PostgreSQL with optional search and filter options."""
    tenant_id = user.get("tenant_id") or "public"
    bugs = get_db_bugs(tenant_id=tenant_id)
    
    if search:
        s = search.lower().strip()
        bugs = [
            b for b in bugs
            if s in b["title"].lower() or s in b["id"].lower() or s in (b.get("assignee") or "").lower()
        ]
        
    if status_filter:
        bugs = [b for b in bugs if (b.get("status") or "").lower() == status_filter.lower()]
        
    if severity:
        bugs = [b for b in bugs if (b.get("severity") or "").lower() == severity.lower()]
        
    if priority:
        bugs = [b for b in bugs if (b.get("priority") or "").lower() == priority.lower()]
        
    if project:
        bugs = [b for b in bugs if (b.get("project") or "").lower() == project.lower()]

    return {
        "success": True,
        "total": len(bugs),
        "bugs": bugs
    }

@router.post("/bugs")
def create_bug(
    payload: Union[BugCreateSchema, List[BugCreateSchema]],
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Creates a new bug ticket (or batch of bug tickets), persists to PostgreSQL and logs activity."""
    reporter_name = user.get("name") or user.get("username") or "Current User"
    actor = reporter_name.split("@")[0].capitalize()
    created_date = datetime.now().strftime("%d %b %Y")
    user_initials = reporter_name[:2].upper()
    tenant_id = user.get("tenant_id") or "public"

    items = payload if isinstance(payload, list) else [payload]
    created_bugs = []

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            for item in items:
                pref = get_project_bug_prefix(item.project)
                cur.execute("SELECT id FROM quality_bugs WHERE id LIKE %s", (f"{pref}-%",))
                existing_rows = cur.fetchall()
                existing_ids = []
                for (bid,) in existing_rows:
                    digits = re.findall(r'\d+', bid)
                    if digits:
                        existing_ids.append(int(digits[-1]))
                next_num = max(existing_ids, default=120) + 1
                new_id = f"{pref}-{next_num:05d}"
                
                priority_val = item.priority
                if " - " in priority_val:
                    priority_val = priority_val.split(" - ")[1]

                new_bug = {
                    "id": new_id,
                    "title": item.title.strip(),
                    "project": item.project,
                    "module": item.module,
                    "environment": item.environment,
                    "priority": priority_val,
                    "severity": item.severity,
                    "status": "Open",
                    "bug_type": item.bug_type,
                    "assignee": item.assignee,
                    "reported_by": actor,
                    "created_on": created_date,
                    "steps_to_reproduce": item.steps_to_reproduce or "",
                    "expected_result": item.expected_result or "",
                    "actual_result": item.actual_result or "",
                    "attachments": item.attachments or []
                }

                cur.execute("""
                    INSERT INTO quality_bugs (
                        id, title, project, module, environment, priority, severity,
                        status, bug_type, assignee, reported_by, created_on,
                        steps_to_reproduce, expected_result, actual_result, attachments
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    new_bug["id"], new_bug["title"], new_bug["project"], new_bug["module"],
                    new_bug["environment"], new_bug["priority"], new_bug["severity"],
                    new_bug["status"], new_bug["bug_type"], new_bug["assignee"],
                    new_bug["reported_by"], new_bug["created_on"], new_bug["steps_to_reproduce"],
                    new_bug["expected_result"], new_bug["actual_result"],
                    json.dumps(new_bug["attachments"])
                ))
                created_bugs.append(new_bug)

            conn.commit()
    finally:
        conn.close()

    if len(created_bugs) == 1:
        add_db_activity(actor, user_initials, f"{actor} created ticket {created_bugs[0]['id']} ({created_bugs[0]['title']}).", tenant_id=tenant_id)
        return {
            "success": True,
            "message": f"Bug {created_bugs[0]['id']} created successfully",
            "bug": created_bugs[0],
            "updated_dashboard": compute_dashboard_metrics(tenant_id=tenant_id)
        }
    else:
        add_db_activity(actor, user_initials, f"{actor} reported {len(created_bugs)} bug tickets in batch.", tenant_id=tenant_id)
        return {
            "success": True,
            "message": f"Successfully created {len(created_bugs)} bug tickets",
            "bugs": created_bugs,
            "count": len(created_bugs),
            "updated_dashboard": compute_dashboard_metrics(tenant_id=tenant_id)
        }

@router.get("/bugs/{bug_id}")
def get_bug_by_id(
    bug_id: str,
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieves a single bug from PostgreSQL by ID."""
    tenant_id = user.get("tenant_id") or "public"
    bug = get_db_bug_by_id(bug_id, tenant_id=tenant_id)
    if bug:
        return {"success": True, "bug": bug}
    raise HTTPException(status_code=404, detail=f"Bug ticket {bug_id} not found")

@router.patch("/bugs/{bug_id}")
def update_bug(
    bug_id: str,
    payload: BugUpdateSchema,
    scope: str = Query("personal"),
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Updates bug properties (e.g. status transition or field edit) in PostgreSQL."""
    tenant_id = user.get("tenant_id") or "public"
    user_name = user.get("name") or user.get("username") or "Rishit"
    target_bug = get_db_bug_by_id(bug_id, tenant_id=tenant_id)
    
    if not target_bug:
        raise HTTPException(status_code=404, detail=f"Bug ticket {bug_id} not found")

    # Enforce access control: only assigned owner or super_admin can edit or update
    if user.get("role") != "super_admin" and not is_bug_assigned_to_user(target_bug, user_name):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: Only the assigned person ({target_bug.get('assignee', 'the owner')}) can edit or update ticket {bug_id}."
        )

    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        return {
            "success": True,
            "message": f"No changes provided for bug {bug_id}",
            "bug": target_bug,
            "updated_dashboard": compute_dashboard_metrics(user_filter=user_name if scope == "personal" else None, tenant_id=tenant_id)
        }

    actor = (user.get("name") or user.get("username") or "User").split("@")[0].capitalize()
    
    # Check if status is transitioning to Resolved or Closed
    if "status" in update_data:
        new_st = update_data["status"]
        if new_st in ("Resolved", "Closed"):
            update_data["resolved_by"] = actor
            update_data["resolved_at"] = datetime.now().strftime("%d %b %Y, %I:%M %p")
            activity_text = f"{actor} marked {target_bug['id']} as {new_st}."
        else:
            activity_text = f"{actor} updated status of {target_bug['id']} to {new_st}."
    else:
        activity_text = f"{actor} updated details of ticket {target_bug['id']}."

    # Build SQL update dynamically
    set_clauses = []
    params = []
    for k, v in update_data.items():
        if k == "attachments" and isinstance(v, (list, dict)):
            set_clauses.append(f"{k} = %s")
            params.append(json.dumps(v))
        else:
            set_clauses.append(f"{k} = %s")
            params.append(v)

    set_clauses.append("updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE quality_bugs SET {', '.join(set_clauses)} WHERE LOWER(id) = LOWER(%s)"
    params.append(bug_id.strip())

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute(sql, tuple(params))
            conn.commit()
    finally:
        conn.close()

    add_db_activity(actor, actor[:2].upper(), activity_text, tenant_id=tenant_id)

    updated_bug = get_db_bug_by_id(bug_id, tenant_id=tenant_id)
    user_filter = user_name if scope == "personal" else None
    return {
        "success": True,
        "message": f"Bug {bug_id} updated successfully",
        "bug": updated_bug,
        "updated_dashboard": compute_dashboard_metrics(user_filter=user_filter, tenant_id=tenant_id)
    }

@router.delete("/bugs/{bug_id}")
def delete_bug(
    bug_id: str,
    scope: str = Query("personal"),
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Deletes a bug ticket from PostgreSQL."""
    tenant_id = user.get("tenant_id") or "public"
    actor = (user.get("name") or user.get("username") or "User").split("@")[0].capitalize()
    target_bug = get_db_bug_by_id(bug_id, tenant_id=tenant_id)
    
    if not target_bug:
        raise HTTPException(status_code=404, detail=f"Bug ticket {bug_id} not found")

    if user.get("role") != "super_admin" and not is_bug_assigned_to_user(target_bug, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: Only {target_bug.get('assignee', 'the owner')} can delete ticket {bug_id}."
        )

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute("DELETE FROM quality_bugs WHERE LOWER(id) = LOWER(%s)", (bug_id.strip(),))
            conn.commit()
    finally:
        conn.close()

    add_db_activity(actor, actor[:2].upper(), f"{actor} deleted bug ticket {bug_id}.", tenant_id=tenant_id)
    
    user_name = user.get("name") or user.get("username") or "Rishit"
    user_filter = user_name if scope == "personal" else None
    return {
        "success": True,
        "message": f"Bug {bug_id} deleted successfully",
        "updated_dashboard": compute_dashboard_metrics(user_filter=user_filter, tenant_id=tenant_id)
    }

@router.post("/bugs/submit-debug")
def submit_debugging_info(
    payload: SubmitDebugSchema,
    scope: str = Query("personal"),
    user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Submits debugging notes, reassigns bug to QA tester and marks status as Resolved in PostgreSQL."""
    tenant_id = user.get("tenant_id") or "public"
    actor = (user.get("name") or user.get("username") or "User").split("@")[0].capitalize()
    target_ids = payload.bug_ids or []
    updated_bugs = []
    
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            for b_id in target_ids:
                cur.execute("SELECT * FROM quality_bugs WHERE LOWER(id) = LOWER(%s)", (b_id.strip(),))
                row = cur.fetchone()
                if not row:
                    continue

                cur.execute("""
                    UPDATE quality_bugs
                    SET status = 'Resolved',
                        assignee = %s,
                        tester = %s,
                        debugging_notes = %s,
                        verification_steps = %s,
                        environment = %s,
                        resolved_by = %s,
                        resolved_at = %s,
                        handed_off_to_tester = %s,
                        removed_from_dev_list = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE LOWER(id) = LOWER(%s)
                """, (
                    payload.tester,
                    payload.tester,
                    payload.debugging_notes,
                    payload.verification_steps or "",
                    payload.environment or "Staging",
                    actor,
                    now_str,
                    bool(payload.remove_from_my_list),
                    bool(payload.remove_from_my_list),
                    b_id.strip()
                ))
            conn.commit()
    finally:
        conn.close()

    for b_id in target_ids:
        b = get_db_bug_by_id(b_id, tenant_id=tenant_id)
        if b:
            updated_bugs.append(b)
            add_db_activity(actor, actor[:2].upper(), f"{actor} submitted {b['id']} with debugging info to tester {payload.tester}.", tenant_id=tenant_id)

    user_name = user.get("name") or user.get("username") or "Rishit"
    user_filter = user_name if scope == "personal" else None
    return {
        "success": True,
        "message": f"Submitted {len(updated_bugs)} bug(s) to QA tester {payload.tester}.",
        "updated_bugs": updated_bugs,
        "updated_dashboard": compute_dashboard_metrics(user_filter=user_filter, tenant_id=tenant_id)
    }

# ============================================================================
# QUALITY CENTRAL PROJECTS ENDPOINTS (PostgreSQL + Dynamic Sync)
# ============================================================================

DEFAULT_QUALITY_PROJECTS = [
    {
        "id": "proj-tc-01",
        "name": "Talent Central",
        "prefix": "#TC",
        "severity": "Normal",
        "health_rate": 96,
        "status": "Active",
        "open_bugs": 2,
        "in_progress_bugs": 1,
        "resolved_bugs": 14,
        "active_bugs": 3,
        "critical_bugs": 0,
        "lead": "Bhupesh",
        "developers": ["Sriraj", "Priyanshu", "Akshit"],
        "qa": ["Vidhi"],
        "description": "Talent acquisition pipeline, ATS resume parser, candidate interview orchestration, and hiring workflows."
    },
    {
        "id": "proj-lc-02",
        "name": "Learning Central",
        "prefix": "#LC",
        "severity": "Normal",
        "health_rate": 97,
        "status": "Active",
        "open_bugs": 1,
        "in_progress_bugs": 2,
        "resolved_bugs": 16,
        "active_bugs": 3,
        "critical_bugs": 0,
        "lead": "Bhupesh",
        "developers": ["Sriraj", "Priyanshu", "Akshit"],
        "qa": ["Vidhi"],
        "description": "Enterprise LMS learning tracks, skill matrices, compliance assessments, and interactive training modules."
    },
    {
        "id": "proj-ac-03",
        "name": "Assessment Central",
        "prefix": "#AC",
        "severity": "High",
        "health_rate": 92,
        "status": "Active",
        "open_bugs": 3,
        "in_progress_bugs": 2,
        "resolved_bugs": 11,
        "active_bugs": 5,
        "critical_bugs": 0,
        "lead": "Bhupesh",
        "developers": ["Sriraj", "Priyanshu", "Akshit"],
        "qa": ["Vidhi"],
        "description": "Online testing framework, proctoring controls, candidate score evaluation, and automated skill grading."
    },
    {
        "id": "proj-ec-04",
        "name": "Employee Central",
        "prefix": "#EC",
        "severity": "Normal",
        "health_rate": 95,
        "status": "Active",
        "open_bugs": 2,
        "in_progress_bugs": 1,
        "resolved_bugs": 22,
        "active_bugs": 3,
        "critical_bugs": 0,
        "lead": "Bhupesh",
        "developers": ["Sriraj", "Priyanshu", "Akshit"],
        "qa": ["Vidhi"],
        "description": "Core employee directory, attendance tracking, organizational hierarchy, payroll, and profile self-service."
    },
    {
        "id": "proj-qc-05",
        "name": "Quality Central",
        "prefix": "#QC",
        "severity": "Normal",
        "health_rate": 99,
        "status": "Active",
        "open_bugs": 1,
        "in_progress_bugs": 1,
        "resolved_bugs": 19,
        "active_bugs": 2,
        "critical_bugs": 0,
        "lead": "Bhupesh",
        "developers": ["Rishit", "Vidhi"],
        "qa": ["Sriraj", "Akshit"],
        "description": "Automated test suite orchestration, defect lifecycle tracking, SLA monitor, and engineering quality assurance."
    },
    {
        "id": "proj-lex-06",
        "name": "LexAI",
        "prefix": "#LEX",
        "severity": "Critical",
        "health_rate": 86,
        "status": "Active",
        "open_bugs": 4,
        "in_progress_bugs": 3,
        "resolved_bugs": 15,
        "active_bugs": 7,
        "critical_bugs": 1,
        "lead": "Bhupesh",
        "developers": ["Rishit", "Vidhi", "Akshit"],
        "qa": ["Sriraj", "Vidhi"],
        "description": "Generative legal AI assistant, neural document summarization, contract review, and compliance intelligence."
    }
]

def get_db_projects(tenant_id: str = "public") -> List[Dict[str, Any]]:
    """Fetches all projects from PostgreSQL quality_projects with live bug counts from quality_bugs."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute("""
                SELECT id, name, prefix, severity, health_rate, status, lead, developers, qa, description, created_at
                FROM quality_projects
                ORDER BY created_at ASC, id ASC
            """)
            rows = cur.fetchall()
            if not rows:
                return DEFAULT_QUALITY_PROJECTS

            # Aggregated bug counts per project
            cur.execute("""
                SELECT project, status, severity, COUNT(*) as cnt
                FROM quality_bugs
                GROUP BY project, status, severity
            """)
            bug_rows = cur.fetchall()

            bug_stats_by_proj = {}
            for br in bug_rows:
                p_name = (br.get("project") or "").strip().lower()
                st = (br.get("status") or "").strip().lower()
                sev = (br.get("severity") or "").strip().lower()
                cnt = br.get("cnt") or 0
                if p_name not in bug_stats_by_proj:
                    bug_stats_by_proj[p_name] = {
                        "open_bugs": 0, "in_progress_bugs": 0, "resolved_bugs": 0, "critical_bugs": 0
                    }
                if st == "open":
                    bug_stats_by_proj[p_name]["open_bugs"] += cnt
                elif st in ("in progress", "in_progress"):
                    bug_stats_by_proj[p_name]["in_progress_bugs"] += cnt
                elif st in ("resolved", "closed"):
                    bug_stats_by_proj[p_name]["resolved_bugs"] += cnt
                if sev == "critical" and st != "closed":
                    bug_stats_by_proj[p_name]["critical_bugs"] += cnt

            # Filter strictly to the 6 allowed core projects
            valid_rows = [
                r for r in rows
                if (r.get("name") or "").strip().lower() in ALLOWED_CORE_PROJECTS
            ]

            existing_names = {(r.get("name") or "").strip().lower() for r in valid_rows}
            for def_p in DEFAULT_QUALITY_PROJECTS:
                if def_p["name"].strip().lower() not in existing_names:
                    valid_rows.append(dict(def_p))

            projects = []
            for r in valid_rows:
                p = dict(r)
                devs = p.get("developers")
                if isinstance(devs, str):
                    try:
                        p["developers"] = json.loads(devs)
                    except Exception:
                        p["developers"] = []
                elif not devs:
                    p["developers"] = []

                qa_list = p.get("qa")
                if isinstance(qa_list, str):
                    try:
                        p["qa"] = json.loads(qa_list)
                    except Exception:
                        p["qa"] = []
                elif not qa_list:
                    p["qa"] = []

                if p.get("created_at") and hasattr(p["created_at"], "strftime"):
                    p["created_at"] = p["created_at"].strftime("%d %b %Y")

                clean_name = (p.get("name") or "").strip().lower()
                clean_prefix = (p.get("prefix") or "").strip().lower()
                matched_stats = None
                for k, stats in bug_stats_by_proj.items():
                    if k == clean_name or k == clean_prefix or clean_name in k or k in clean_name:
                        matched_stats = stats
                        break

                if matched_stats:
                    p["open_bugs"] = matched_stats["open_bugs"]
                    p["in_progress_bugs"] = matched_stats["in_progress_bugs"]
                    p["resolved_bugs"] = matched_stats["resolved_bugs"]
                    p["active_bugs"] = matched_stats["open_bugs"] + matched_stats["in_progress_bugs"]
                    p["critical_bugs"] = matched_stats["critical_bugs"]
                else:
                    p.setdefault("open_bugs", 0)
                    p.setdefault("in_progress_bugs", 0)
                    p.setdefault("resolved_bugs", 0)
                    p.setdefault("active_bugs", 0)
                    p.setdefault("critical_bugs", 0)

                projects.append(p)

            return projects
    except Exception as e:
        print(f"[QualityDB] Error fetching projects: {e}")
        return DEFAULT_QUALITY_PROJECTS
    finally:
        conn.close()

def save_db_project(proj: Dict[str, Any], tenant_id: str = "public") -> bool:
    """Inserts or updates a project into PostgreSQL quality_projects."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            cur.execute("""
                INSERT INTO quality_projects (
                    id, name, prefix, severity, health_rate, status, lead, developers, qa, description
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (name) DO UPDATE SET
                    prefix = EXCLUDED.prefix,
                    severity = EXCLUDED.severity,
                    health_rate = EXCLUDED.health_rate,
                    status = EXCLUDED.status,
                    lead = EXCLUDED.lead,
                    developers = EXCLUDED.developers,
                    qa = EXCLUDED.qa,
                    description = EXCLUDED.description,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                proj["id"],
                proj["name"],
                proj["prefix"],
                proj.get("severity", "Normal"),
                proj.get("health_rate", 95),
                proj.get("status", "Active"),
                proj.get("lead", "Bhupesh"),
                json.dumps(proj.get("developers", [])),
                json.dumps(proj.get("qa", [])),
                proj.get("description", "")
            ))
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        print(f"[QualityDB] Error saving project: {e}")
        return False
    finally:
        conn.close()

def update_db_project(project_id: str, updates: Dict[str, Any], tenant_id: str = "public") -> Optional[Dict[str, Any]]:
    """Updates an existing project in PostgreSQL quality_projects."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SET search_path TO "{tenant_id}"')
            set_clauses = ["updated_at = CURRENT_TIMESTAMP"]
            params = []
            for col in ["name", "prefix", "severity", "health_rate", "status", "lead", "description"]:
                if col in updates and updates[col] is not None:
                    set_clauses.append(f"{col} = %s")
                    params.append(updates[col])
            for json_col in ["developers", "qa"]:
                if json_col in updates and updates[json_col] is not None:
                    set_clauses.append(f"{json_col} = %s::jsonb")
                    params.append(json.dumps(updates[json_col]))

            sql = f"UPDATE quality_projects SET {', '.join(set_clauses)} WHERE LOWER(id) = LOWER(%s) OR LOWER(prefix) = LOWER(%s) OR LOWER(name) = LOWER(%s)"
            cur.execute(sql, (*params, project_id.strip(), project_id.strip(), project_id.strip()))
            conn.commit()

            cur.execute("""
                SELECT id, name, prefix, severity, health_rate, status, lead, developers, qa, description, created_at
                FROM quality_projects
                WHERE LOWER(id) = LOWER(%s) OR LOWER(prefix) = LOWER(%s) OR LOWER(name) = LOWER(%s)
            """, (project_id.strip(), project_id.strip(), project_id.strip()))
            row = cur.fetchone()
            if row:
                res = dict(row)
                for f in ["developers", "qa"]:
                    if isinstance(res.get(f), str):
                        try:
                            res[f] = json.loads(res[f])
                        except Exception:
                            res[f] = []
                return res
            return None
    except Exception as e:
        conn.rollback()
        print(f"[QualityDB] Error updating project {project_id}: {e}")
        return None
    finally:
        conn.close()

def get_user_or_default(request: Request) -> Dict[str, Any]:
    """Resolves authenticated session or falls back to standard public tenant admin context."""
    try:
        return get_current_user(request)
    except Exception:
        return {
            "id": 1,
            "username": "admin@phygitron.com",
            "name": "Bhupesh",
            "role": "org_admin",
            "tenant_id": "public",
            "employee_code": "EMP001"
        }

@router.get("/projects")
def get_quality_projects(user: dict = Depends(get_user_or_default)) -> Dict[str, Any]:
    """Retrieves all registered projects in Quality Central from PostgreSQL."""
    tenant_id = user.get("tenant_id", "public")
    projs = get_db_projects(tenant_id=tenant_id)
    return {
        "success": True,
        "total": len(projs),
        "projects": projs
    }

@router.post("/projects")
def create_quality_project(
    payload: ProjectCreateSchema,
    user: dict = Depends(get_user_or_default)
) -> Dict[str, Any]:
    """Registers a new project under Quality Central oversight and stores in PostgreSQL."""
    tenant_id = user.get("tenant_id", "public")
    clean_name = payload.name.strip().lower()
    if clean_name not in ALLOWED_CORE_PROJECTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration restricted: Only the 6 core Phygitron360 modules (Talent Central, Learning Central, Assessment Central, Employee Central, Quality Central, LexAI) are supported."
        )

    clean_prefix = payload.prefix if payload.prefix.startswith("#") else f"#{payload.prefix}"
    new_proj = {
        "id": f"proj-{int(datetime.now().timestamp())}",
        "name": payload.name,
        "prefix": clean_prefix,
        "severity": payload.severity,
        "health_rate": int(payload.health_rate),
        "status": payload.status,
        "open_bugs": 0,
        "in_progress_bugs": 0,
        "resolved_bugs": 0,
        "active_bugs": 0,
        "critical_bugs": 0,
        "lead": payload.lead or "Bhupesh",
        "developers": payload.developers or ["Rishit", "Vidhi"],
        "qa": payload.qa or ["Vidhi"],
        "description": payload.description or ""
    }

    # Persist to PostgreSQL
    save_db_project(new_proj, tenant_id=tenant_id)

    # Also update in-memory list
    DEFAULT_QUALITY_PROJECTS.insert(0, new_proj)

    # Log activity
    user_name = user.get("name") or user.get("username") or "Admin"
    add_db_activity(
        user_name=user_name,
        avatar=user_name[:2].upper(),
        text=f"Registered project {new_proj['name']} ({new_proj['prefix']}) under Quality Central.",
        tenant_id=tenant_id
    )

    return {
        "success": True,
        "message": f"Project '{new_proj['name']}' ({new_proj['prefix']}) registered successfully.",
        "project": new_proj
    }

@router.put("/projects/{project_id}")
def update_quality_project(
    project_id: str,
    payload: ProjectUpdateSchema,
    user: dict = Depends(get_user_or_default)
) -> Dict[str, Any]:
    """Updates an existing project's metadata, lead, developers, health rate, or status in PostgreSQL."""
    tenant_id = user.get("tenant_id", "public")
    updates = payload.dict(exclude_unset=True)

    updated_proj = update_db_project(project_id, updates, tenant_id=tenant_id)
    if not updated_proj:
        # Fallback in-memory update
        for p in DEFAULT_QUALITY_PROJECTS:
            if p["id"] == project_id or p.get("prefix") == project_id:
                for k, v in updates.items():
                    if v is not None:
                        p[k] = v
                updated_proj = p
                break

    if not updated_proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found."
        )

    # Log activity
    user_name = user.get("name") or user.get("username") or "Admin"
    add_db_activity(
        user_name=user_name,
        avatar=user_name[:2].upper(),
        text=f"Updated project details for {updated_proj.get('name', project_id)}.",
        tenant_id=tenant_id
    )

    return {
        "success": True,
        "message": f"Project '{updated_proj.get('name', project_id)}' updated successfully.",
        "project": updated_proj
    }

@router.get("/team")
def get_quality_team(user: dict = Depends(get_user_or_default)) -> Dict[str, Any]:
    """Returns active team employees directly from PostgreSQL employees table."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            tenant_id = user.get("tenant_id") or "public"
            cur.execute(f'SET search_path TO "{tenant_id}", public')
            cur.execute("""
                SELECT employee_code, name, first_name, email_id, designation, team, employment_status
                FROM employees
                WHERE employment_status = 'Active'
                ORDER BY employee_code ASC
            """)
            rows = cur.fetchall()
            team = []
            for r in rows:
                member_name = r.get("name") or r.get("first_name") or "Member"
                parts = member_name.split()
                initials = "".join([p[0].upper() for p in parts if p])[:2] if parts else "EM"
                team.append({
                    "id": (r.get("employee_code") or member_name).lower(),
                    "employee_code": r.get("employee_code"),
                    "name": member_name,
                    "role": r.get("designation") or "Engineer",
                    "email": r.get("email_id") or f"{member_name.lower()}@phygitron.com",
                    "team": r.get("team") or "Engineering",
                    "initials": initials
                })
            return {
                "success": True,
                "total": len(team),
                "team": team
            }
    except Exception as e:
        print(f"[QualityDB] Error fetching team members: {e}")
        return {
            "success": False,
            "total": 0,
            "team": []
        }
    finally:
        conn.close()

