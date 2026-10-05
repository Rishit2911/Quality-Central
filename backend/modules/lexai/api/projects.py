from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from .. import schemas
from ..services.project_service import ProjectService

router = APIRouter(prefix="/api/lexai/projects", tags=["lexai-projects"])
alias_history_router = APIRouter(prefix="/api/history", tags=["lexai-history-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

@router.get("/", response_model=List[schemas.ProjectResponse], dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_VIEW))])
@alias_history_router.get("/", response_model=List[schemas.ProjectResponse], dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_VIEW))])
def get_user_projects(current_user: dict = Depends(get_current_user)):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)
    return service.get_user_projects(emp_code)

@router.get("/{project_id}", response_model=schemas.ProjectDetailResponse, dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_VIEW))])
@alias_history_router.get("/{project_id}", response_model=schemas.ProjectDetailResponse, dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_VIEW))])
def get_project_detail(project_id: str, current_user: dict = Depends(get_current_user)):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)
    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
@alias_history_router.delete("/{project_id}", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)
    deleted = service.delete_project(project_id, emp_code)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully"}
