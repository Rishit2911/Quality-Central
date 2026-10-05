from pydantic import BaseModel
from typing import Optional

class InviteRequest(BaseModel):
    employee_code: Optional[str] = None
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    guardian_name: Optional[str] = None
    email: str
    role: str = "Employee"
    department: Optional[str] = None
    designation: Optional[str] = None
    doj: Optional[str] = None

class InviteResponse(BaseModel):
    id: int
    token: str
    name: str
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    role: str
    department: Optional[str]
    designation: Optional[str]
    status: str
    created_at: str
    expires_at: Optional[str]

class VerifyTokenRequest(BaseModel):
    token: str

class ApprovalRequest(BaseModel):
    reporting_manager: Optional[str] = None
    employment_type: str = "Full Time"
    pf_included: str = "No"
    mediclaim_included: str = "No"
    notes: Optional[str] = None
