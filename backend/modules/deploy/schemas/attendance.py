from pydantic import BaseModel
from typing import Optional, List

# --- Request Schemas ---

class ClockInRequest(BaseModel):
    local_date: Optional[str] = None
    local_time: Optional[str] = None

class ClockOutRequest(BaseModel):
    work_log: str
    local_date: Optional[str] = None
    local_time: Optional[str] = None

class LeaveRequest(BaseModel):
    start_date: str
    end_date: str
    leave_type: str
    reason: str
    start_day_type: str = "Full Day"
    end_day_type: str = "Full Day"

class EditAttendanceRequest(BaseModel):
    employee_code: str
    date: str
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    clock_out_date: Optional[str] = None
    work_log: Optional[str] = None

class LeaveActionRequest(BaseModel):
    action: str
    reason: Optional[str] = None

# --- Correction Schemas (Two-Track Model) ---

class SelfServiceCorrectionRequest(BaseModel):
    """
    Employee self-corrects a date within the open weekly window.
    Applied immediately to the attendance table — no manager approval needed.
    Window: Mon(target_week) → Mon(target_week + 7 days). Closes on next Monday.
    """
    date: str
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    clock_out_date: Optional[str] = None
    reason: str
    client_date: Optional[str] = None  # Employee's local date (YYYY-MM-DD) for timezone-aware validation

class CorrectionRequestSchema(BaseModel):
    """
    Employee requests a correction for a date outside the self-service window.
    Requires manager approval before being applied.
    """
    date: str
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    clock_out_date: Optional[str] = None
    reason: str
    client_date: Optional[str] = None  # Employee's local date (YYYY-MM-DD) for timezone-aware validation

class CorrectionActionRequest(BaseModel):
    """Manager approves or rejects a requested correction."""
    action: str                             # 'Approved' | 'Rejected'
    rejection_reason: Optional[str] = None

# --- Response Schemas ---

class AttendanceRecord(BaseModel):
    id: int
    employee_code: str
    date: str
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    clock_out_date: Optional[str] = None
    work_log: Optional[str] = None
    status: str = 'Active'
    ip_address: Optional[str] = None

class LeaveRecord(BaseModel):
    id: int
    employee_code: str
    start_date: str
    end_date: str
    duration_days: Optional[float] = None
    start_day_type: Optional[str] = None
    end_day_type: Optional[str] = None
    leave_type: str
    reason: str
    status: str
    rejection_reason: Optional[str]
    applied_at: str
    employee_name: Optional[str] = None  # Enriched field

class AttendanceStatus(BaseModel):
    status: str
    data: Optional[AttendanceRecord] = None

class LeaveBalance(BaseModel):
    total_leaves: float
    used_leaves: float
    extended_leaves: float

class CorrectionWindowDay(BaseModel):
    """A single day entry in the correction window response."""
    date: str
    weekday: str                    # 'Monday', 'Tuesday', etc.
    status: str                     # attendance status for that day
    clock_in: Optional[str]
    clock_out: Optional[str]
    work_log: Optional[str]
    track: str                      # 'self_service' | 'requested' | 'future' | 'today'
    pending_correction: Optional[dict] = None   # Existing pending correction if any
    is_holiday: Optional[bool] = False
    holiday_name: Optional[str] = None
    holiday_type: Optional[str] = None
    is_half_day: Optional[bool] = False
    is_leave: Optional[bool] = False
    leave_type: Optional[str] = None


