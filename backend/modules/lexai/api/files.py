import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from backend.core.database import DATA_DIR
from .. import schemas
from ..services.project_service import ProjectService

router = APIRouter(prefix="/api/lexai/files", tags=["lexai-files"])
alias_files_router = APIRouter(prefix="/api/files", tags=["lexai-files-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

def get_upload_dir(current_user: dict) -> str:
    tenant_id = current_user.get('tenant_id', 'public')
    emp_code = get_emp_code(current_user)
    path = os.path.join(DATA_DIR, 'uploads', 'lexai', tenant_id, emp_code)
    os.makedirs(path, exist_ok=True)
    return path

async def upload_file_impl(
    folder_id: Optional[int],
    file: UploadFile,
    current_user: dict
):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    if folder_id:
        folder = service.get_folder_detail(folder_id, emp_code)
        if not folder:
            raise HTTPException(status_code=403, detail="Unauthorized access to folder")

    upload_dir = get_upload_dir(current_user)
    file_path = os.path.join(upload_dir, file.filename)

    content = await file.read()
    file_size = len(content)
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    return service.create_file(
        employee_code=emp_code,
        name=file.filename,
        folder_id=folder_id,
        file_type=file.content_type or "application/octet-stream",
        file_path=file_path,
        file_size=file_size
    )

@router.post("/upload", response_model=schemas.UserFileResponse, dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
async def upload_file(
    folder_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    return await upload_file_impl(folder_id, file, current_user)

@alias_files_router.post("/upload", response_model=schemas.UserFileResponse, dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
async def upload_file_alias(
    folder_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    return await upload_file_impl(folder_id, file, current_user)

def get_files_impl(folder_id: Optional[int], current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)
    return service.get_files(emp_code, folder_id)

@router.get("/", response_model=List[schemas.UserFileResponse], dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def get_files(folder_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    return get_files_impl(folder_id, current_user)

@alias_files_router.get("/", response_model=List[schemas.UserFileResponse], dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def get_files_alias(folder_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    return get_files_impl(folder_id, current_user)

def download_file_impl(file_id: int, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    user_file = service.get_file(file_id, emp_code)
    if not user_file:
        raise HTTPException(status_code=404, detail="File not found")

    if not os.path.exists(user_file["file_path"]):
        raise HTTPException(status_code=404, detail="File content missing on server")

    return FileResponse(
        path=user_file["file_path"],
        filename=user_file["name"],
        media_type=user_file.get("file_type") or "application/octet-stream"
    )

@router.get("/{file_id}/download", dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def download_file(file_id: int, current_user: dict = Depends(get_current_user)):
    return download_file_impl(file_id, current_user)

@alias_files_router.get("/{file_id}/download", dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def download_file_alias(file_id: int, current_user: dict = Depends(get_current_user)):
    return download_file_impl(file_id, current_user)

def delete_file_impl(file_id: int, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    user_file = service.delete_file(file_id, emp_code)
    if not user_file:
        raise HTTPException(status_code=404, detail="File not found")

    if user_file.get("file_path") and os.path.exists(user_file["file_path"]):
        try:
            os.remove(user_file["file_path"])
        except Exception:
            pass

    return {"message": "File deleted successfully"}

@router.delete("/{file_id}", dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def delete_file(file_id: int, current_user: dict = Depends(get_current_user)):
    return delete_file_impl(file_id, current_user)

@alias_files_router.delete("/{file_id}", dependencies=[Depends(require_permission(P.LEXAI_FILES_MANAGE))])
def delete_file_alias(file_id: int, current_user: dict = Depends(get_current_user)):
    return delete_file_impl(file_id, current_user)
