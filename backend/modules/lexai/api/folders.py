from fastapi import APIRouter, Depends, HTTPException
from typing import List
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from .. import schemas
from ..services.project_service import ProjectService

router = APIRouter(prefix="/api/lexai/folders", tags=["lexai-folders"])
alias_folders_router = APIRouter(prefix="/api/folders", tags=["lexai-folders-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

@router.get("/", response_model=List[schemas.FolderResponse], dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
@alias_folders_router.get("/", response_model=List[schemas.FolderResponse], dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def get_folders(current_user: dict = Depends(get_current_user)):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)
    return service.get_root_folders(emp_code)

@router.get("/{folder_id}", response_model=schemas.FolderDetailResponse, dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
@alias_folders_router.get("/{folder_id}", response_model=schemas.FolderDetailResponse, dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def get_folder_detail(folder_id: int, current_user: dict = Depends(get_current_user)):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)
    folder = service.get_folder_detail(folder_id, emp_code)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder

def create_folder_impl(folder_in: schemas.FolderCreate, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    if folder_in.parent_id:
        parent = service.get_folder_detail(folder_in.parent_id, emp_code)
        if not parent:
            raise HTTPException(status_code=403, detail="Unauthorized access to parent folder")

    return service.create_folder(emp_code, folder_in.name, folder_in.parent_id)

@router.post("/", response_model=schemas.FolderResponse, dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def create_folder(folder_in: schemas.FolderCreate, current_user: dict = Depends(get_current_user)):
    return create_folder_impl(folder_in, current_user)

@alias_folders_router.post("/", response_model=schemas.FolderResponse, dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def create_folder_alias(folder_in: schemas.FolderCreate, current_user: dict = Depends(get_current_user)):
    return create_folder_impl(folder_in, current_user)

def delete_folder_impl(folder_id: int, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)
    deleted = service.delete_folder(folder_id, emp_code)
    if not deleted:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"message": "Folder deleted successfully"}

@router.delete("/{folder_id}", dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def delete_folder(folder_id: int, current_user: dict = Depends(get_current_user)):
    return delete_folder_impl(folder_id, current_user)

@alias_folders_router.delete("/{folder_id}", dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def delete_folder_alias(folder_id: int, current_user: dict = Depends(get_current_user)):
    return delete_folder_impl(folder_id, current_user)
