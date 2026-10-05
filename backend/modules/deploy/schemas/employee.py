from pydantic import BaseModel
from typing import Optional, List, Any

# Common Models
class EmployeeBasicInfo(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    employee_code: Optional[str] = None
    designation: Optional[str] = None
    team: Optional[str] = None
    reporting_manager: Optional[str] = None
    email_id: Optional[str] = None
    photo_path: Optional[str] = None
    employment_status: Optional[str] = None
    exit_date: Optional[str] = None
    role: Optional[str] = None

class EmployeeFullProfile(BaseModel):
    # First and last name are mandatory, middle name is optional
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    employee_code: Optional[str] = None
    id: Optional[int] = None
    dob: Optional[str] = None
    contact_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_contact_first_name: Optional[str] = None
    emergency_contact_middle_name: Optional[str] = None
    emergency_contact_last_name: Optional[str] = None
    email_id: Optional[str] = None
    doj: Optional[str] = None 
    team: Optional[str] = None
    designation: Optional[str] = None
    employment_type: Optional[str] = None
    reporting_manager: Optional[str] = None
    location: Optional[str] = None
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None
    education_details: Optional[str] = None
    employment_status: Optional[str] = None
    photo_path: Optional[str] = None
    cv_path: Optional[str] = None
    id_proofs: Optional[str] = None
    passbook_path: Optional[str] = None
    pf_included: Optional[str] = None
    mediclaim_included: Optional[str] = None
    notes: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    pan_no: Optional[str] = None
    ifsc_code: Optional[str] = None
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = None
    clearance_status: Optional[str] = None
    
    # Relations (Dictionaries/Lists)
    skill_matrix: Optional[dict] = {}
    assets: Optional[List[dict]] = []
    performance: Optional[List[dict]] = []
    hr_activity: Optional[List[dict]] = []
    kra_assignments: Optional[List[dict]] = []

class UpdateEmployeeRequest(BaseModel):
    # All fields optional for updates
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    designation: Optional[str] = None
    team: Optional[str] = None
    contact_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_contact_first_name: Optional[str] = None
    emergency_contact_middle_name: Optional[str] = None
    emergency_contact_last_name: Optional[str] = None
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None
    dob: Optional[str] = None
    email_id: Optional[str] = None
    reporting_manager: Optional[str] = None
    location: Optional[str] = None
    primary_skillset: Optional[str] = None
    secondary_skillset: Optional[str] = None
    experience_years: Optional[Any] = None
    education_details: Optional[Any] = None
    pf_included: Optional[str] = None
    mediclaim_included: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    pan_no: Optional[str] = None
    ifsc_code: Optional[str] = None
    employee_code: Optional[str] = None
    doj: Optional[str] = None
    skill_matrix: Optional[dict] = None

class OffboardRequest(BaseModel):
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = None
    exit_type: Optional[str] = "Immediate"
    remarks: Optional[str] = ""