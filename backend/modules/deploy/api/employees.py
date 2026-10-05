from fastapi import APIRouter, HTTPException, Depends, Form, File, UploadFile, Body
from typing import List, Optional
from backend.core.dependencies import require_permission, get_current_user
from backend.modules.deploy.services.employee_service import EmployeeService
from backend.modules.deploy.schemas.employee import UpdateEmployeeRequest, OffboardRequest
from backend.core.database import DATA_DIR
from backend.common.services.storage_service import save_uploaded_file
from backend.modules.deploy.services.notification_service import add_notification
import os
import shutil
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["employees"])

def get_service(tenant_id: str = 'public'):
    return EmployeeService(tenant_id=tenant_id)

@router.get("/employees")
def get_employees(current_user: dict = Depends(get_current_user)):
    perms = current_user.get('permissions', [])
    if isinstance(perms, dict):
        can_view_all = bool(perms.get("deploy.employees.view_list"))
        can_view_team = bool(perms.get("deploy.employees.view_team"))
    else:
        can_view_all = "deploy.employees.view_list" in perms
        can_view_team = "deploy.employees.view_team" in perms

    if not can_view_all and not can_view_team:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    
    if can_view_all:
        return service.get_all_employees()
    else:
        employee_code = current_user.get('employee_code')
        if not employee_code:
            return []
        return service.get_team_employees(employee_code)

@router.get("/employee/{employee_code}", dependencies=[Depends(require_permission(["deploy.employees.view_profile", "deploy.employees.view_personal"]))])
def get_employee(employee_code: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    employee = service.get_employee_full_details(employee_code)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    is_self = current_user.get("employee_code") == employee_code
    roles = current_user.get("roles", [])
    is_super = "super_admin" in roles or "superadmin" in roles
    
    perms = current_user.get('permissions', {})
    if isinstance(perms, list):
        can_view_any = "deploy.employees.view_profile" in perms
        can_view_sensitive = "deploy.employees.view_profile_sensitive" in perms
        can_view_financial = "deploy.employees.view_profile_financial" in perms
    elif isinstance(perms, dict):
        can_view_any = bool(perms.get("deploy.employees.view_profile"))
        can_view_sensitive = bool(perms.get("deploy.employees.view_profile_sensitive"))
        can_view_financial = bool(perms.get("deploy.employees.view_profile_financial"))
    else:
        can_view_any = False
        can_view_sensitive = False
        can_view_financial = False

    if not can_view_any and not is_self and not is_super:
        raise HTTPException(status_code=403, detail="You can only view your own profile")

    if not (is_self or is_super or can_view_sensitive):
        sensitive_fields = ['dob', 'contact_number', 'emergency_contact', 'emergency_contact_first_name', 'emergency_contact_middle_name', 'emergency_contact_last_name', 'current_address', 'permanent_address', 'cv_path', 'id_proofs']
        for f in sensitive_fields:
            if f in employee and employee[f] is not None:
                employee[f] = "***REDACTED***" if isinstance(employee[f], str) else None

    if not (is_self or is_super or can_view_financial):
        financial_fields = ['bank_name', 'bank_account_no', 'pan_no', 'ifsc_code', 'passbook_path', 'pf_included', 'mediclaim_included']
        for f in financial_fields:
            if f in employee and employee[f] is not None:
                employee[f] = "***REDACTED***" if isinstance(employee[f], str) else None

    employee["_meta"] = {
        "can_view_sensitive": is_self or is_super or can_view_sensitive,
        "can_view_financial": is_self or is_super or can_view_financial
    }

    return employee

@router.get("/employee/{employee_code}/document/{doc_type}")
def get_employee_document(employee_code: str, doc_type: str, download: bool = False, current_user: dict = Depends(get_current_user)):
    """Serves an employee's uploaded photo/cv/id_proof.

    Access rules:
    - The employee may always access their own documents (is_self).
    - Admins/HR with deploy.employees.view_profile_sensitive may access any document.
    - Everyone else gets a 403. Profile photos (doc_type='pfp') are public within
      the tenant so they are always served (needed for directory avatars etc.)."""
    is_self = current_user.get('employee_code') == employee_code
    roles = current_user.get('roles', [])
    is_super = 'super_admin' in roles or 'superadmin' in roles
    perms = current_user.get('permissions', {})
    can_view_sensitive = bool(perms.get('deploy.employees.view_profile_sensitive')) if isinstance(perms, dict) else False
    can_view_financial = bool(perms.get('deploy.employees.view_profile_financial')) if isinstance(perms, dict) else False

    # Profile photos are non-sensitive — any authenticated user can load them.
    # The passbook is a financial document, so it's gated by the financial
    # permission rather than the general sensitive-docs one (mirrors how bank
    # fields are gated separately from address/DOB elsewhere in this API).
    if doc_type == 'passbook':
        if not (is_self or is_super or can_view_financial):
            raise HTTPException(status_code=403, detail="You do not have permission to access this document.")
    elif doc_type != 'pfp' and not (is_self or is_super or can_view_sensitive):
        raise HTTPException(status_code=403, detail="You do not have permission to access this document.")

    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    file_path = service.get_document_path(employee_code, doc_type)
    if not file_path:
        raise HTTPException(status_code=404, detail="Document not found")

    if file_path.startswith("http://") or file_path.startswith("https://"):
        from fastapi.responses import RedirectResponse
        from backend.common.services.storage_service import generate_presigned_url
        presigned = generate_presigned_url(file_path, expiry_seconds=900)
        return RedirectResponse(url=presigned)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing from storage")

    from fastapi.responses import FileResponse
    return FileResponse(
        file_path,
        filename=os.path.basename(file_path),
        content_disposition_type="attachment" if download else "inline"
    )

@router.post("/employee", dependencies=[Depends(require_permission("deploy.employees.create"))])
async def create_employee(
    # First and last name are mandatory, middle name is optional, all others optional
    first_name: str = Form(...),
    middle_name: Optional[str] = Form(None),
    last_name: str = Form(...),
    code: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    emergency: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    doj: Optional[str] = Form(None),
    team: Optional[str] = Form(None),
    designation: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    type: Optional[str] = Form(None),
    manager: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    current_address: Optional[str] = Form(None),
    permanent_address: Optional[str] = Form(None),
    pf: Optional[str] = Form(None),
    mediclaim: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    primary_skillset: Optional[str] = Form(None),
    secondary_skillset: Optional[str] = Form(None),
    experience_years: Optional[float] = Form(None),
    ifsc_code: Optional[str] = Form(None),
    photo_file: Optional[UploadFile] = File(None),
    cv_file: Optional[UploadFile] = File(None),
    id_proof_file: Optional[UploadFile] = File(None),
    passbook_file: Optional[UploadFile] = File(None),
    education_details: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)

    # Save files only if they exist
    photo_path = None
    if photo_file and photo_file.filename:
        photo_path = save_uploaded_file(photo_file, tenant_id, 'deploy', 'pfp', code or 'unknown', 'pfp')

    cv_path = None
    if cv_file and cv_file.filename:
        cv_path = save_uploaded_file(cv_file, tenant_id, 'deploy', 'resume', code or 'unknown', 'cv')

    id_proofs_path = None
    if id_proof_file and id_proof_file.filename:
        id_proofs_path = save_uploaded_file(id_proof_file, tenant_id, 'deploy', 'identification_docs', code or 'unknown', 'id_proof')

    passbook_path = None
    if passbook_file and passbook_file.filename:
        passbook_path = save_uploaded_file(passbook_file, tenant_id, 'deploy', 'passbook', code or 'unknown', 'passbook')

    parsed_education_details = []
    if education_details:
        try:
            parsed = json.loads(education_details)
            if isinstance(parsed, list):
                parsed_education_details = parsed
        except json.JSONDecodeError:
            pass

    data = {
        "first_name": first_name,
        "middle_name": middle_name,
        "last_name": last_name,
        "code": code,
        "dob": dob,
        "phone": phone,
        "emergency": emergency,
        "email": email,
        "doj": doj,
        "team": team,
        "designation": designation,
        "role": role,
        "type": type,
        "manager": manager,
        "location": location,
        "current_address": current_address,
        "permanent_address": permanent_address,
        "pf": pf,
        "mediclaim": mediclaim,
        "notes": notes,
        "education_details": parsed_education_details,
        "primary_skillset": primary_skillset,
        "secondary_skillset": secondary_skillset,
        "experience_years": experience_years,
        "ifsc_code": ifsc_code,
        "photo_path": photo_path,
        "cv_path": cv_path,
        "id_proofs": id_proofs_path,
        "passbook_path": passbook_path
    }

    try:
        return service.create_employee(data, actor=current_user.get('username', 'system'))
    except ValueError as e:
         raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
         logger.exception("Failed to create employee: %s", e)
         raise HTTPException(status_code=500, detail="Something went wrong while creating this employee. Please try again.")

# Field groups protected by specific permissions
_FINANCIAL_FIELDS = frozenset({
    'bank_name', 'bank_account_no', 'pan_no', 'ifsc_code', 'pf_included', 'mediclaim_included'
})
_JOB_FIELDS = frozenset({
    'designation', 'team', 'reporting_manager', 'location',
    'employment_type', 'doj', 'employment_status', 'experience_years'
})


@router.put("/employee/{employee_code}")
def update_employee(employee_code: str, data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update an employee record.

    Field-level permission enforcement (defence-in-depth):
    - Financial fields require deploy.employees.edit_financial
    - Job / employment fields require deploy.employees.edit_job
    - Basic fields are allowed for anyone with deploy.employees.edit_basic or if it's their own profile
    Super-admins bypass all field restrictions.
    """
    role = current_user.get('role', '')
    roles = current_user.get('roles', []) or ([role] if role else [])
    all_roles = set(roles + ([role] if role else []))
    is_super = 'super_admin' in all_roles or 'superadmin' in all_roles
    is_org_admin = 'org_admin' in all_roles or role == 'org_admin'
    isAdmin = is_super or is_org_admin

    perms = current_user.get('permissions', {})
    is_self = current_user.get('employee_code') == employee_code

    if isinstance(perms, dict):
        can_edit_basic = isAdmin or bool(perms.get('deploy.employees.edit_basic'))
        can_edit_financial = isAdmin or bool(perms.get('deploy.employees.edit_financial')) or bool(perms.get('deploy.employees.approve_financial'))
        can_edit_job = isAdmin or bool(perms.get('deploy.employees.edit_job')) or bool(perms.get('deploy.employees.approve_basic'))
    else:
        can_edit_basic = isAdmin
        can_edit_financial = isAdmin
        can_edit_job = isAdmin

    if not (can_edit_basic or is_self):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if not isAdmin:
        # Strip fields the caller is not authorised to write
        if not can_edit_financial:
            for field in _FINANCIAL_FIELDS:
                data.pop(field, None)
        if not can_edit_job:
            for field in _JOB_FIELDS:
                data.pop(field, None)

    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    try:
        result = service.update_employee(employee_code, data)
        # Notify the employee if someone else edited their profile
        if current_user.get('employee_code') != employee_code:
            add_notification(
                title="Profile Updated",
                message="Your employee profile has been updated by admin.",
                employee_code=employee_code,
                n_type="Info",
                tenant_id=tenant_id
            )
        return result
    except Exception as e:
        logger.exception("Failed to update employee %s: %s", employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while saving these changes. Please try again.")

@router.post("/employee/{employee_code}/documents")
async def upload_documents(
    employee_code: str,
    photo_file: Optional[UploadFile] = File(None),
    cv_file: Optional[UploadFile] = File(None),
    id_proof_file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload documents for an employee."""
    role = current_user.get('role')
    perms = current_user.get('permissions', {})
    can_manage_docs = (
        bool(perms.get('deploy.employees.manage_documents')) or
        bool(perms.get('deploy.onboarding.review_submissions')) or
        bool(perms.get('deploy.employees.edit_basic'))
    ) if isinstance(perms, dict) else role in ('super_admin', 'org_admin')
    is_self = current_user.get('employee_code') == employee_code
    
    if not (can_manage_docs or is_self):
        raise HTTPException(status_code=403, detail="Insufficient permissions to manage documents")

    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    updates = {}
    
    if photo_file and photo_file.filename:
        updates['photo_path'] = save_uploaded_file(photo_file, tenant_id, 'deploy', 'pfp', employee_code, 'pfp')
    if cv_file and cv_file.filename:
        updates['cv_path'] = save_uploaded_file(cv_file, tenant_id, 'deploy', 'resume', employee_code, 'cv')
    if id_proof_file and id_proof_file.filename:
        updates['id_proofs'] = save_uploaded_file(id_proof_file, tenant_id, 'deploy', 'identification_docs', employee_code, 'id_proof')
        
    if not updates:
        return {"message": "No files received"}

    try:
        service.update_employee(employee_code, updates)
        updated_emp = service.repo.get_employee_by_code(employee_code, tenant_id)
        return updated_emp or updates
    except Exception as e:
        logger.exception("Failed to upload documents for employee %s: %s", employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while uploading these documents. Please try again.")

@router.delete("/employee/{employee_code}/photo")
async def remove_employee_photo(
    employee_code: str,
    current_user: dict = Depends(get_current_user)
):
    """Clears an employee's profile photo. Self-service, no approval needed."""
    role = current_user.get('role')
    perms = current_user.get('permissions', {})
    can_manage_docs = (
        bool(perms.get('deploy.employees.manage_documents')) or
        bool(perms.get('deploy.onboarding.review_submissions')) or
        bool(perms.get('deploy.employees.edit_basic'))
    ) if isinstance(perms, dict) else role in ('super_admin', 'org_admin')
    is_self = current_user.get('employee_code') == employee_code

    if not (can_manage_docs or is_self):
        raise HTTPException(status_code=403, detail="Insufficient permissions to manage documents")

    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    try:
        service.repo.update_employee_fields(employee_code, ['photo_path'], [None], tenant_id)
        return {"message": "Photo removed"}
    except Exception as e:
        logger.exception("Failed to remove photo for employee %s: %s", employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while removing the photo. Please try again.")

@router.get("/employee-edit-requests/pending", dependencies=[Depends(require_permission(["deploy.employees.view_list", "deploy.employees.view_team"]))])
def list_pending_edit_requests(current_user: dict = Depends(get_current_user)):
    """HR-facing list of all employees' pending self-service edit requests."""
    from backend.modules.deploy.services.profile_edit_request_service import ProfileEditRequestService
    tenant_id = current_user.get('tenant_id', 'public')
    return ProfileEditRequestService(tenant_id=tenant_id).list_pending_requests()

def _can_review_edit_requests(current_user: dict) -> bool:
    roles = [r.lower() for r in (current_user.get('roles') or [current_user.get('role')]) if r]
    is_super = 'super_admin' in roles or 'superadmin' in roles
    perms = current_user.get('permissions', {})
    has_perm = isinstance(perms, dict) and (perms.get('deploy.employees.approve_basic') or perms.get('deploy.onboarding.review_submissions'))
    return bool(is_super or has_perm)

def _serve_stored_document(path: Optional[str]):
    if not path:
        raise HTTPException(status_code=404, detail="Document not found")
    if path.startswith("http://") or path.startswith("https://"):
        from fastapi.responses import RedirectResponse
        from backend.common.services.storage_service import generate_presigned_url
        return RedirectResponse(url=generate_presigned_url(path, expiry_seconds=900))
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File missing from storage")
    from fastapi.responses import FileResponse
    return FileResponse(path, filename=os.path.basename(path), content_disposition_type="inline")

@router.get("/employee-edit-requests/{request_id}/preview/field/{field_key}", dependencies=[Depends(require_permission(["deploy.employees.view_list", "deploy.employees.view_team"]))])
def preview_edit_request_field(request_id: int, field_key: str, current_user: dict = Depends(get_current_user)):
    from backend.modules.deploy.services.profile_edit_request_service import ProfileEditRequestService
    tenant_id = current_user.get('tenant_id', 'public')
    path = ProfileEditRequestService(tenant_id=tenant_id).resolve_document_path(request_id, 'field', field_key)
    return _serve_stored_document(path)

@router.get("/employee-edit-requests/{request_id}/preview/support/{index}", dependencies=[Depends(require_permission(["deploy.employees.view_list", "deploy.employees.view_team"]))])
def preview_edit_request_support(request_id: int, index: int, current_user: dict = Depends(get_current_user)):
    from backend.modules.deploy.services.profile_edit_request_service import ProfileEditRequestService
    tenant_id = current_user.get('tenant_id', 'public')
    path = ProfileEditRequestService(tenant_id=tenant_id).resolve_document_path(request_id, 'support', str(index))
    return _serve_stored_document(path)

@router.post("/employee-edit-requests/{request_id}/review")
def review_edit_request(
    request_id: int,
    decision: str = Body(..., embed=True),
    review_notes: Optional[str] = Body(None, embed=True),
    current_user: dict = Depends(get_current_user)
):
    if not _can_review_edit_requests(current_user):
        raise HTTPException(status_code=403, detail="Missing permission to review edit requests")

    from backend.modules.deploy.services.profile_edit_request_service import ProfileEditRequestService
    tenant_id = current_user.get('tenant_id', 'public')
    service = ProfileEditRequestService(tenant_id=tenant_id)
    try:
        return service.review_request(request_id, decision, current_user.get('username'), review_notes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to review edit request %s: %s", request_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while reviewing this request. Please try again.")

@router.get("/employee/{employee_code}/edit-requests/pending")
def get_pending_edit_request(employee_code: str, current_user: dict = Depends(get_current_user)):
    """Lets the profile page show a 'request already pending' banner instead of
    silently failing when the employee tries to submit a second one."""
    if current_user.get('employee_code') != employee_code:
        raise HTTPException(status_code=403, detail="You can only view your own edit requests")
    from backend.modules.deploy.services.profile_edit_request_service import ProfileEditRequestService
    tenant_id = current_user.get('tenant_id', 'public')
    return ProfileEditRequestService(tenant_id=tenant_id).get_pending_request(employee_code)

@router.get("/employee/{employee_code}/edit-requests/latest-decision")
def get_latest_edit_request_decision(employee_code: str, current_user: dict = Depends(get_current_user)):
    """Lets the profile page show a one-time 'your edits were rejected' banner
    for the most recent rejection the employee hasn't dismissed yet."""
    if current_user.get('employee_code') != employee_code:
        raise HTTPException(status_code=403, detail="You can only view your own edit requests")
    from backend.modules.deploy.services.profile_edit_request_service import ProfileEditRequestService
    tenant_id = current_user.get('tenant_id', 'public')
    return ProfileEditRequestService(tenant_id=tenant_id).get_latest_unacknowledged_decision(employee_code)

@router.post("/employee/{employee_code}/edit-requests/{request_id}/acknowledge")
def acknowledge_edit_request(employee_code: str, request_id: int, current_user: dict = Depends(get_current_user)):
    """Dismisses the rejection banner so it doesn't keep reappearing."""
    if current_user.get('employee_code') != employee_code:
        raise HTTPException(status_code=403, detail="You can only manage your own edit requests")
    from backend.modules.deploy.services.profile_edit_request_service import ProfileEditRequestService
    tenant_id = current_user.get('tenant_id', 'public')
    try:
        return ProfileEditRequestService(tenant_id=tenant_id).acknowledge_request(request_id, employee_code)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/employee/{employee_code}/edit-requests")
async def submit_edit_request(
    employee_code: str,
    fields: str = Form(...),
    notes: Optional[str] = Form(None),
    photo_file: Optional[UploadFile] = File(None),
    cv_file: Optional[UploadFile] = File(None),
    id_proof_file: Optional[UploadFile] = File(None),
    supporting_files: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user)
):
    """Self-service: an employee proposes changes to their own profile. Nothing
    on the employees row changes here — this only records the request and
    notifies the employee + admins. Reviewing/applying it is separate work."""
    if current_user.get('employee_code') != employee_code:
        raise HTTPException(status_code=403, detail="You can only request edits to your own profile")

    import json
    try:
        field_values = json.loads(fields)
        if not isinstance(field_values, dict):
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid fields payload")

    doc_files = {}
    if photo_file and photo_file.filename:
        doc_files['photo_path'] = photo_file
    if cv_file and cv_file.filename:
        doc_files['cv_path'] = cv_file
    if id_proof_file and id_proof_file.filename:
        doc_files['id_proofs'] = id_proof_file

    from backend.modules.deploy.services.profile_edit_request_service import ProfileEditRequestService
    tenant_id = current_user.get('tenant_id', 'public')
    service = ProfileEditRequestService(tenant_id=tenant_id)
    try:
        return service.submit_request(
            employee_code,
            field_values,
            doc_files,
            [f for f in (supporting_files or []) if f and f.filename],
            notes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to submit edit request for employee %s: %s", employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while submitting your request. Please try again.")

@router.delete("/employee/{employee_code}", dependencies=[Depends(require_permission("deploy.employees.delete"))])
def delete_employee(employee_code: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    try:
        return service.delete_employee(employee_code, actor=current_user.get('username', 'system'))
    except ValueError as e:
         raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
         logger.exception("Failed to delete employee %s: %s", employee_code, e)
         raise HTTPException(status_code=500, detail="Something went wrong while deleting this employee. Please try again.")

@router.get("/options", dependencies=[Depends(require_permission(["deploy.employees.view_list", "deploy.employees.view_team"]))])
def get_dropdown_options(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    return service.get_options()

@router.post("/employee/{employee_code}/offboard", dependencies=[Depends(require_permission("deploy.employees.offboard"))])
def offboard_employee(employee_code: str, data: OffboardRequest, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    try:
        result = service.offboard_employee(employee_code, data, actor=current_user.get('username', 'system'))
        add_notification(
            title="Offboarding Initiated",
            message="Your offboarding process has been initiated. Please complete any pending exit formalities and return company assets.",
            employee_code=employee_code,
            n_type="Alert",
            tenant_id=tenant_id
        )
        return result
    except Exception as e:
        logger.exception("Failed to offboard employee %s: %s", employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while offboarding this employee. Please try again.")

import io
import json
import pandas as pd
from fastapi.responses import StreamingResponse

@router.get("/employees/bulk-upload/template", dependencies=[Depends(require_permission("deploy.employees.create"))])
def get_bulk_upload_template():
    columns = [
        "Employee Code", "First Name", "Middle Name", "Last Name", "Guardian Name", "Email ID", "Role", "Date of Joining",
        "Designation", "Team / Department", "Employment Type", "Reporting Manager", 
        "Base Location", "Employment Status", "Date of Birth", "Contact Number", 
        "Emergency Contact Name", "Emergency Contact", "Current Address", "Permanent Address", 
        "Primary Skills", "Secondary Skills", "Experience Years", "Education Details",
        "Bank Name", "Bank Account No.", "PAN No.", "PF Included", "Mediclaim Included", "Notes"
    ]
    df = pd.DataFrame(columns=columns)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Template')
        
        workbook = writer.book
        worksheet = writer.sheets['Template']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#D7E4BC',
            'border': 1
        })
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            worksheet.set_column(col_num, col_num, 20)
            
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="employee_bulk_upload_template.xlsx"'
    }
    
    return StreamingResponse(output, headers=headers, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@router.post("/employees/bulk", dependencies=[Depends(require_permission("deploy.employees.create"))])
def bulk_upload_employees(employees: List[dict] = Body(...), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenant_id', 'public')
    service = get_service(tenant_id)
    
    results = {
        "total": len(employees),
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    clean_rows = []
    emails_seen = set()
    codes_seen = set()
    
    # PASS 1: Pre-validate all rows
    for idx, row in enumerate(employees):
        try:
            # First Name and Last Name are mandatory - everything else can be blank/None
            first_name = str(row.get("First Name", "")).strip()
            middle_name = str(row.get("Middle Name", "")).strip() or None
            last_name = str(row.get("Last Name", "")).strip()
            if not first_name or not last_name:
                raise ValueError("First Name and Last Name are mandatory")

            # Employee Code and Email are also mandatory for bulk upload
            emp_code = str(row.get("Employee Code", "")).strip()
            emp_email = str(row.get("Email ID", "")).strip()
            if not emp_code:
                raise ValueError("Employee Code is mandatory")
            if not emp_email:
                raise ValueError("Email ID is mandatory")

            # Build data dict with safe defaults for ALL fields
            data = {
                "code": str(row.get("Employee Code", "")).strip() or None,
                "first_name": first_name,
                "middle_name": middle_name,
                "last_name": last_name,
                "guardian_name": str(row.get("Guardian Name", "")).strip() or None,
                "dob": str(row.get("Date of Birth", "")).strip() or None,
                "phone": str(row.get("Contact Number", "")).strip() or None,
                "emergency": str(row.get("Emergency Contact", "")).strip() or None,
                "email": str(row.get("Email ID", "")).strip() or None,
                "doj": str(row.get("Date of Joining", "")).strip() or None,
                "team": str(row.get("Team / Department", "")).strip() or None,
                "designation": str(row.get("Designation", "")).strip() or None,
                "role": str(row.get("Role", "employee")).strip().lower() or "employee",
                "type": str(row.get("Employment Type", "Full-time")).strip() or "Full-time",
                "manager": str(row.get("Reporting Manager", "")).strip() or None,
                "location": str(row.get("Base Location", "")).strip() or None,
                "employment_status": str(row.get("Employment Status", "Active")).strip() or "Active",
                "current_address": str(row.get("Current Address", "")).strip() or None,
                "permanent_address": str(row.get("Permanent Address", "")).strip() or None,
                "pf": "Yes" if str(row.get("PF Included", "")).strip().lower() in ['yes', 'true', '1'] else "No",
                "mediclaim": "Yes" if str(row.get("Mediclaim Included", "")).strip().lower() in ['yes', 'true', '1'] else "No",
                "notes": str(row.get("Notes", "")).strip() or None,
                "primary_skillset": str(row.get("Primary Skills", "")).strip() or None,
                "secondary_skillset": str(row.get("Secondary Skills", "")).strip() or None,
                "experience_years": None,  # Will be handled below
                "bank_name": str(row.get("Bank Name", "")).strip() or None,
                "bank_account_no": str(row.get("Bank Account No.", "")).strip() or None,
                "pan_no": str(row.get("PAN No.", "")).strip() or None,
                "photo_path": None,
                "cv_path": None,
                "id_proofs": None,
                "education_details": []
            }
            
            # Handle experience years safely
            exp_years = row.get("Experience Years")
            if exp_years is not None and str(exp_years).strip():
                try:
                    data["experience_years"] = float(exp_years)
                except (ValueError, TypeError):
                    data["experience_years"] = None
            else:
                data["experience_years"] = None
            
            # Handle education details safely
            edu_details = str(row.get("Education Details", "")).strip()
            if edu_details:
                try:
                    education_details = json.loads(edu_details)
                    if isinstance(education_details, list):
                        data["education_details"] = education_details
                except json.JSONDecodeError:
                    data["education_details"] = []
            else:
                data["education_details"] = []
            
            # Remove None values so service uses defaults
            # But keep name parts and any other fields that might have values
            clean_data = {}
            for k, v in data.items():
                if v is not None:
                    clean_data[k] = v
                elif k in ("first_name", "last_name"):  # Always keep mandatory name parts
                    clean_data[k] = v
                elif k == "employment_status":  # Keep defaults
                    clean_data[k] = v
                elif k == "type":  # Keep defaults
                    clean_data[k] = v
                elif k == "role":  # Keep defaults
                    clean_data[k] = v
                elif k == "pf":  # Keep defaults
                    clean_data[k] = v
                elif k == "mediclaim":  # Keep defaults
                    clean_data[k] = v
                elif k == "education_details":  # Keep empty list
                    clean_data[k] = v
                elif k == "guardian_name":
                    clean_data[k] = v
            
            # Make sure we have at least the mandatory fields
            clean_data.setdefault("first_name", first_name)
            clean_data.setdefault("last_name", last_name)
            
            # Check for intra-file duplicates
            if clean_data.get('email'):
                if clean_data['email'] in emails_seen:
                    raise ValueError(f"Duplicate email '{clean_data['email']}' within the upload file.")
                emails_seen.add(clean_data['email'])
                
            if clean_data.get('code'):
                if clean_data['code'] in codes_seen:
                    raise ValueError(f"Duplicate Employee Code '{clean_data['code']}' within the upload file.")
                codes_seen.add(clean_data['code'])

            # Pre-validate with service (checks DB for conflicts and valid roles)
            service.validate_employee_data(clean_data)
            clean_rows.append(clean_data)
            
        except Exception as e:
            results["failed"] += 1
            error_detail = str(e)
            results["errors"].append({
                "row": idx + 1,
                "code": str(row.get("Employee Code", "Unknown")),
                "name": f"{row.get('First Name', '')} {row.get('Last Name', '')}".strip() or "Unknown",
                "error": error_detail
            })
            
    # If ANY row failed validation, reject the entire file
    if results["errors"]:
        results["success"] = 0
        results["failed"] = len(employees)
        return results
        
    # PASS 2: Execution (all rows validated successfully)
    for idx, clean_data in enumerate(clean_rows):
        try:
            service.create_employee(clean_data)
            results["success"] += 1
        except Exception as e:
            # Should not happen as we pre-validated, but handle just in case
            results["failed"] += 1
            error_detail = str(e)
            results["errors"].append({
                "row": idx + 1,
                "code": clean_data.get("code", "Unknown"),
                "name": f"{clean_data.get('first_name', '')} {clean_data.get('last_name', '')}".strip() or "Unknown",
                "error": f"Database insertion failed: {error_detail}"
            })
            
    return results