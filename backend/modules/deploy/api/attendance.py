from fastapi import APIRouter, HTTPException, Depends, Request, Form
from typing import List, Optional
from backend.core.database import get_db_connection
from backend.core.dependencies import get_current_user, require_permission
from backend.modules.deploy.services.attendance_service import AttendanceService
from backend.modules.deploy.schemas.attendance import (
    ClockInRequest, ClockOutRequest, LeaveRequest, AttendanceStatus,
    LeaveBalance, LeaveRecord, AttendanceRecord, EditAttendanceRequest,
    SelfServiceCorrectionRequest, CorrectionRequestSchema, CorrectionActionRequest, CorrectionWindowDay
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

# Dependency Injection for Service
def get_service(user=Depends(get_current_user)):
    return AttendanceService(tenant_id=user.get('tenant_id', 'public'))

# Helper — raises a clear error if the user is not linked to an employee profile
def _require_employee_code(user: dict) -> str:
    code = user.get('employee_code')
    if not code:
        raise HTTPException(
            status_code=400,
            detail="Your account is not linked to an employee profile. Contact your administrator."
        )
    return code

# --- Attendance Endpoints ---

@router.get("/status")
def get_attendance_status(user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    emp_code = _require_employee_code(user)
    return service.get_status(emp_code)

@router.post("/clock-in")
def clock_in(request: Request, user=Depends(get_current_user), service: AttendanceService = Depends(get_service), data: Optional[ClockInRequest] = None):
    emp_code = _require_employee_code(user)
    try:
        local_date = data.local_date if data else None
        local_time = data.local_time if data else None
        return service.clock_in(emp_code, request.client.host, local_date, local_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to clock in employee %s: %s", emp_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while clocking you in. Please try again.")

@router.post("/clock-out")
def clock_out(data: ClockOutRequest, user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    emp_code = _require_employee_code(user)
    try:
        return service.clock_out(emp_code, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to clock out employee %s: %s", emp_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while clocking you out. Please try again.")

@router.get("/history")
def get_attendance_history(user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    emp_code = _require_employee_code(user)
    return service.get_history(emp_code)

# --- Leave Management Endpoints ---

@router.get("/leave/balance")
def get_leave_balance(user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    emp_code = _require_employee_code(user)
    return service.get_leave_balance(emp_code)

@router.post("/leave/apply")
def apply_leave(req: LeaveRequest, user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    emp_code = _require_employee_code(user)
    try:
        return service.apply_leave(emp_code, req, user['role'])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to apply leave for employee %s: %s", emp_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while submitting your leave request. Please try again.")

@router.get("/leave/my-requests")
def get_my_leaves(user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    emp_code = _require_employee_code(user)
    return service.get_my_leaves(emp_code)

# --- Admin/HR Endpoints ---

@router.get("/leave/all-requests")
def get_all_leave_requests(user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    perms = user.get('permissions', {})
    role = 'admin' if perms.get('deploy.attendance.view_all') else ('manager' if perms.get('deploy.attendance.view_team') else 'employee')
    return service.get_all_pending_leaves(role, user.get('employee_code'))

@router.get("/admin/today")
def get_daily_attendance_log(date: Optional[str] = None, user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    perms = user.get('permissions', {})
    role = 'admin' if perms.get('deploy.attendance.view_all') else ('manager' if perms.get('deploy.attendance.view_team') else 'employee')
    return service.get_daily_log(date, role, user.get('employee_code'))

@router.post("/leave/action/{leave_id}")
def approve_reject_leave(
    leave_id: int, 
    action: str = Form(...), 
    reason: str = Form(None), 
    user=Depends(get_current_user),
    service: AttendanceService = Depends(get_service)
):
    if action not in ['Approved', 'Rejected']:
         raise HTTPException(status_code=400, detail="Invalid action")

    try:
        return service.approve_reject_leave(leave_id, action, reason, user['role'], user.get('employee_code'))
    except ValueError as e:
        # Check against specific messages to determine 403 vs 404 vs 400
        msg = str(e)
        if "not found" in msg:
             raise HTTPException(status_code=404, detail=msg)
        elif "cannot approve" in msg or "only be approved" in msg:
             raise HTTPException(status_code=403, detail=msg)
        else:
             raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        logger.exception("Failed to approve/reject leave %s: %s", leave_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while processing this leave request. Please try again.")

@router.get("/admin/summary")
def get_monthly_attendance_summary(year: int, month: int, user=Depends(require_permission(["deploy.attendance.view_all", "deploy.attendance.view_team"])), service: AttendanceService = Depends(get_service)):
    perms = user.get('permissions', {})
    manager_code = None if perms.get('deploy.attendance.view_all') else user.get('employee_code')
    try:
        return service.get_monthly_summary(year, month, manager_code)
    except Exception as e:
        logger.exception("Failed to fetch monthly attendance summary: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while fetching the attendance summary. Please try again.")

@router.post("/admin/edit")
def edit_attendance(req: EditAttendanceRequest, user=Depends(require_permission("deploy.attendance.approve_correction")), service: AttendanceService = Depends(get_service)):
    try:
        return service.edit_attendance(req)
    except Exception as e:
        logger.exception("Failed to edit attendance record: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while saving this attendance record. Please try again.")

@router.get("/admin/employees")
def get_active_employees(user=Depends(require_permission(["deploy.attendance.view_all", "deploy.attendance.view_team"])), service: AttendanceService = Depends(get_service)):
    perms = user.get('permissions', {})
    manager_code = None if perms.get('deploy.attendance.view_all') else user.get('employee_code')
    return service.get_active_employees(manager_code)

@router.get("/admin/employee/{employee_code}/history")
def get_employee_history_admin(
    employee_code: str,
    limit: int = 90,
    user=Depends(require_permission(["deploy.attendance.view_all", "deploy.attendance.view_team"])),
    service: AttendanceService = Depends(get_service)
):
    """Admin/Manager: get full attendance history for any employee."""
    perms = user.get('permissions', {})
    manager_code = None if perms.get('deploy.attendance.view_all') else user.get('employee_code')
    return service.get_history_for_employee(employee_code, limit, manager_code)

@router.get("/admin/employee/{employee_code}/leaves")
def get_employee_leaves_admin(
    employee_code: str,
    user=Depends(require_permission(["deploy.leaves.view_all", "deploy.leaves.view_team"])),
    service: AttendanceService = Depends(get_service)
):
    """Admin/Manager: get all leave records for any employee."""
    perms = user.get('permissions', {})
    manager_code = None if perms.get('deploy.leaves.view_all') else user.get('employee_code')
    return service.get_leaves_for_employee(employee_code, manager_code)


@router.post("/admin/trigger-reminders")
def trigger_missed_clockout_reminders(
    user=Depends(require_permission("deploy.attendance.manage_policies")), 
    service: AttendanceService = Depends(get_service)
):
    """
    Admin endpoint to trigger missed clock-out detection 
    and dispatch reminders.
    """
    try:
        return service.check_and_trigger_missed_clockout_reminders()
    except Exception as e:
        logger.exception("Failed to trigger missed clock-out reminders: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while triggering reminders. Please try again.")

# --- Two-Track Correction Endpoints ---

@router.get("/correction/window")
def get_correction_window(client_date: str = None, user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    """Returns the correctable dates window with statuses and track rules. client_date should be YYYY-MM-DD in the employee's local timezone."""
    emp_code = _require_employee_code(user)
    return service.get_correction_window(emp_code, client_date=client_date)

@router.post("/correction/self-service")
def apply_self_service_correction(req: SelfServiceCorrectionRequest, user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    """Employee self-corrects a date within the open weekly window."""
    emp_code = _require_employee_code(user)
    try:
        return service.apply_self_service_correction(emp_code, req.date, req.clock_in, req.clock_out, req.reason, client_date=getattr(req, 'client_date', None))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to apply self-service correction for employee %s: %s", emp_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while saving your correction. Please try again.")

@router.post("/correction/request")
def apply_correction_request(req: CorrectionRequestSchema, user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    """Employee requests correction for a date outside the self-service window (needs manager approval)."""
    emp_code = _require_employee_code(user)
    try:
        return service.apply_correction_request(emp_code, req.date, req.clock_in, req.clock_out, req.reason, client_date=getattr(req, 'client_date', None))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to submit correction request for employee %s: %s", emp_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while submitting your correction request. Please try again.")

@router.get("/correction/my-history")
def get_my_corrections(user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    """Employee views their own correction history (both self-service and requested)."""
    emp_code = _require_employee_code(user)
    return service.get_my_corrections(emp_code)

@router.get("/correction/pending-requests")
def get_pending_correction_requests(user=Depends(get_current_user), service: AttendanceService = Depends(get_service)):
    """Manager/Admin views pending correction requests for their team."""
    role = user.get('role', 'employee')
    if role == 'employee' and user.get("permissions", {}).get("deploy.attendance.view_team", False):
        role = 'manager'
    return service.get_pending_correction_requests(role, user.get('employee_code'))

@router.post("/correction/request/{correction_id}/action")
def approve_reject_correction_request(
    correction_id: int,
    req: CorrectionActionRequest,
    user=Depends(get_current_user),
    service: AttendanceService = Depends(get_service)
):
    """Manager approves or rejects a pending correction request."""
    if req.action not in ['Approved', 'Rejected']:
        raise HTTPException(status_code=400, detail="Invalid action")
    try:
        return service.approve_reject_correction_request(correction_id, req.action, req.rejection_reason, user['role'], user.get('employee_code'))
    except ValueError as e:
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        elif "cannot approve" in msg or "only be approved" in msg:
            raise HTTPException(status_code=403, detail=msg)
        else:
            raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        logger.exception("Failed to approve/reject correction request %s: %s", correction_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while processing this correction request. Please try again.")

@router.get("/report/bimonthly")
def get_bimonthly_report(
    year: int,
    month: int,
    cycle: int,
    user=Depends(require_permission("deploy.attendance.view_team")),
    service: AttendanceService = Depends(get_service)
):
    perms = user.get('permissions', {})
    manager_code = None if perms.get('deploy.attendance.view_all') else user.get('employee_code')
    try:
        return service.get_bimonthly_report(year, month, cycle, manager_code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to fetch bimonthly attendance report: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while generating this report. Please try again.")

