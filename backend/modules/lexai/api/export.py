import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from ..services.project_service import ProjectService
from ..services import export_service

router = APIRouter(prefix="/api/lexai/export", tags=["lexai-export"])
alias_export_router = APIRouter(prefix="/api/export", tags=["lexai-export-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

def export_design_doc_impl(project_id: str, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project or not project.get("design_doc"):
        raise HTTPException(status_code=404, detail="Design Doc not found")

    try:
        intake_data = json.loads(project.get("intake_data") or "{}")
    except json.JSONDecodeError:
        intake_data = {}

    file_bytes = export_service.export_design_doc_to_xlsx(project["design_doc"], intake_data)

    if not file_bytes:
        raise HTTPException(status_code=500, detail="Failed to generate Excel file")

    return StreamingResponse(
        file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=Design_Document_{project_id}.xlsx"
        }
    )

@router.get("/{project_id}/design-doc", dependencies=[Depends(require_permission(P.LEXAI_EXPORT))])
def export_design_doc(project_id: str, current_user: dict = Depends(get_current_user)):
    return export_design_doc_impl(project_id, current_user)

@alias_export_router.get("/{project_id}/design-doc", dependencies=[Depends(require_permission(P.LEXAI_EXPORT))])
def export_design_doc_alias(project_id: str, current_user: dict = Depends(get_current_user)):
    return export_design_doc_impl(project_id, current_user)

def export_storyboard_impl(project_id: str, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project or not project.get("storyboard"):
        raise HTTPException(status_code=404, detail="Storyboard not found")

    try:
        intake_data = json.loads(project.get("intake_data") or "{}")
    except json.JSONDecodeError:
        intake_data = {}

    file_bytes = export_service.export_storyboard_to_docx(project["storyboard"], intake_data)

    if not file_bytes:
        raise HTTPException(status_code=500, detail="Failed to generate Word file")

    return StreamingResponse(
        file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename=Storyboard_{project_id}.docx"
        }
    )

@router.get("/{project_id}/storyboard", dependencies=[Depends(require_permission(P.LEXAI_EXPORT))])
def export_storyboard(project_id: str, current_user: dict = Depends(get_current_user)):
    return export_storyboard_impl(project_id, current_user)

@alias_export_router.get("/{project_id}/storyboard", dependencies=[Depends(require_permission(P.LEXAI_EXPORT))])
def export_storyboard_alias(project_id: str, current_user: dict = Depends(get_current_user)):
    return export_storyboard_impl(project_id, current_user)
