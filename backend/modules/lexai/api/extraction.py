import tempfile
import pathlib
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from ..services.project_service import ProjectService
from ..services import extraction_service

router = APIRouter(prefix="/api/lexai/extraction", tags=["lexai-extraction"])
alias_extraction_router = APIRouter(prefix="/api/extraction", tags=["lexai-extraction-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

async def extract_content_upload_impl(project_id: str, file: UploadFile, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = pathlib.Path(file.filename).suffix.lower()
    text = ""

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        if ext == '.pdf':
            with open(temp_path, 'rb') as f:
                text = extraction_service.extract_text_from_pdf(f)
        elif ext in ['.docx']:
            text = extraction_service.extract_text_from_docx(temp_path)
        elif ext in ['.xlsx']:
            text = extraction_service.extract_text_from_xlsx(temp_path)
        elif ext in ['.txt']:
            text = extraction_service.extract_text_from_txt(open(temp_path, 'rb'))
        elif ext in ['.pptx']:
            text = extraction_service.extract_text_from_pptx(temp_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        if "Error" in text and text.startswith("Error"):
            raise HTTPException(status_code=400, detail=text)

        existing = project.get("extracted_content") or ""
        new_content = existing + f"\n\n--- SOURCE: {file.filename} ---\n" + text
        service.update_project_data(project_id, emp_code, {"extracted_content": new_content})

        return {"message": "Extracted successfully", "extracted_length": len(text)}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/{project_id}/upload", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def extract_content_upload(project_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    return await extract_content_upload_impl(project_id, file, current_user)

@alias_extraction_router.post("/{project_id}/upload", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def extract_content_upload_alias(project_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    return await extract_content_upload_impl(project_id, file, current_user)

def extract_content_url_impl(project_id: str, url: str, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if 'youtube.com' in url or 'youtu.be' in url:
        text = extraction_service.extract_youtube_transcript(url)
    else:
        text = extraction_service.extract_text_from_url(url)

    if "Error" in text and text.startswith("Error"):
        raise HTTPException(status_code=400, detail=text)

    existing = project.get("extracted_content") or ""
    new_content = existing + f"\n\n--- SOURCE: {url} ---\n" + text
    service.update_project_data(project_id, emp_code, {"extracted_content": new_content})

    return {"message": "Extracted successfully", "extracted_length": len(text)}

@router.post("/{project_id}/url", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
def extract_content_url(project_id: str, url: str = Form(...), current_user: dict = Depends(get_current_user)):
    return extract_content_url_impl(project_id, url, current_user)

@alias_extraction_router.post("/{project_id}/url", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
def extract_content_url_alias(project_id: str, url: str = Form(...), current_user: dict = Depends(get_current_user)):
    return extract_content_url_impl(project_id, url, current_user)

def extract_content_remote_impl(project_id: str, file_id: int, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user_file = service.get_file(file_id, emp_code)
    if not user_file:
        raise HTTPException(status_code=404, detail="File not found")

    ext = pathlib.Path(user_file["name"]).suffix.lower()
    text = ""

    try:
        file_path = user_file["file_path"]
        if ext == '.pdf':
            with open(file_path, 'rb') as f:
                text = extraction_service.extract_text_from_pdf(f)
        elif ext in ['.docx']:
            text = extraction_service.extract_text_from_docx(file_path)
        elif ext in ['.xlsx']:
            text = extraction_service.extract_text_from_xlsx(file_path)
        elif ext in ['.txt']:
            text = extraction_service.extract_text_from_txt(open(file_path, 'rb'))
        elif ext in ['.pptx']:
            text = extraction_service.extract_text_from_pptx(file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        if "Error" in text and text.startswith("Error"):
            raise HTTPException(status_code=400, detail=text)

        existing = project.get("extracted_content") or ""
        new_content = existing + f"\n\n--- SOURCE (FOLDER): {user_file['name']} ---\n" + text
        service.update_project_data(project_id, emp_code, {"extracted_content": new_content})

        return {"message": "Extracted successfully", "extracted_length": len(text)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/remote", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
def extract_content_remote(project_id: str, file_id: int = Form(...), current_user: dict = Depends(get_current_user)):
    return extract_content_remote_impl(project_id, file_id, current_user)

@alias_extraction_router.post("/{project_id}/remote", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
def extract_content_remote_alias(project_id: str, file_id: int = Form(...), current_user: dict = Depends(get_current_user)):
    return extract_content_remote_impl(project_id, file_id, current_user)

async def extract_text_only_impl(file: UploadFile):
    ext = pathlib.Path(file.filename).suffix.lower()
    text = ""

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        if ext == '.pdf':
            with open(temp_path, 'rb') as f:
                text = extraction_service.extract_text_from_pdf(f)
        elif ext in ['.docx']:
            text = extraction_service.extract_text_from_docx(temp_path)
        elif ext in ['.txt']:
            text = extraction_service.extract_text_from_txt(open(temp_path, 'rb'))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        return {"text": text}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/extract-text-only", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def extract_text_only(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    return await extract_text_only_impl(file)

@alias_extraction_router.post("/extract-text-only", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def extract_text_only_alias(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    return await extract_text_only_impl(file)
