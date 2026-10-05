import os
import json
from fastapi import APIRouter, Depends, HTTPException
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from ..services.project_service import ProjectService
from ..services import ai_generation

router = APIRouter(prefix="/api/lexai/design", tags=["lexai-design"])
alias_design_router = APIRouter(prefix="/api/design", tags=["lexai-design-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

def generate_design_doc_impl(project_id: str, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Server misconfiguration: missing AI API Key")

    try:
        intake_data = json.loads(project.get("intake_data") or "{}")
    except json.JSONDecodeError:
        intake_data = {}

    content = project.get("extracted_content") or ""

    if not content:
        raise HTTPException(status_code=400, detail="Cannot generate design doc without extracted source content.")

    generated_doc = ai_generation.generate_design_document(api_key, intake_data, content)
    service.update_project_data(project_id, emp_code, {"design_doc": generated_doc})

    return {"message": "Success", "design_doc": generated_doc}

@router.post("/{project_id}/generate", dependencies=[Depends(require_permission(P.LEXAI_DESIGN_RUN))])
def generate_design_doc(project_id: str, current_user: dict = Depends(get_current_user)):
    return generate_design_doc_impl(project_id, current_user)

@alias_design_router.post("/{project_id}/generate", dependencies=[Depends(require_permission(P.LEXAI_DESIGN_RUN))])
def generate_design_doc_alias(project_id: str, current_user: dict = Depends(get_current_user)):
    return generate_design_doc_impl(project_id, current_user)

def approve_design_doc_impl(project_id: str, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)
    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Design Doc approved for storyboard generation"}

@router.post("/{project_id}/approve", dependencies=[Depends(require_permission(P.LEXAI_DESIGN_RUN))])
def approve_design_doc(project_id: str, current_user: dict = Depends(get_current_user)):
    return approve_design_doc_impl(project_id, current_user)

@alias_design_router.post("/{project_id}/approve", dependencies=[Depends(require_permission(P.LEXAI_DESIGN_RUN))])
def approve_design_doc_alias(project_id: str, current_user: dict = Depends(get_current_user)):
    return approve_design_doc_impl(project_id, current_user)
