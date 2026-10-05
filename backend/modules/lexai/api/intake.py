from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
import json
import pathlib
import tempfile
import os
from dotenv import load_dotenv

from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from .. import schemas
from ..services.project_service import ProjectService
from ..services import extraction_service

load_dotenv()

router = APIRouter(prefix="/api/lexai/intake", tags=["lexai-intake"])
alias_intake_router = APIRouter(prefix="/api/intake", tags=["lexai-intake-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

def create_project_intake_impl(intake_data: dict, current_user: dict):
    try:
        service = get_service(current_user)
        emp_code = get_emp_code(current_user)

        title = intake_data.get('course_title', 'Untitled Course')
        business_unit = intake_data.get('business_unit', '')

        project_create = schemas.ProjectCreate(title=title, business_unit=business_unit)
        project = service.create_project(emp_code, project_create)

        updated_project = service.update_project_data(
            project["id"], emp_code, {"intake_data": json.dumps(intake_data)}
        )
        return updated_project
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=schemas.ProjectResponse, dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
def create_project_intake(intake_data: dict, current_user: dict = Depends(get_current_user)):
    return create_project_intake_impl(intake_data, current_user)

@alias_intake_router.post("/", response_model=schemas.ProjectResponse, dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
def create_project_intake_alias(intake_data: dict, current_user: dict = Depends(get_current_user)):
    return create_project_intake_impl(intake_data, current_user)

async def upload_project_impl(
    file: UploadFile,
    type: str,
    title: str,
    current_user: dict
):
    try:
        service = get_service(current_user)
        emp_code = get_emp_code(current_user)

        # 1. Create Project
        project_create = schemas.ProjectCreate(title=title)
        project = service.create_project(emp_code, project_create)

        # 2. Extract Text
        ext = pathlib.Path(file.filename).suffix.lower()
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
            elif ext in ['.pptx']:
                text = extraction_service.extract_text_from_pptx(temp_path)
            elif ext in ['.txt']:
                text = extraction_service.extract_text_from_txt(open(temp_path, 'rb'))
            else:
                text = "Unsupported format"

            # 3. Beautify Content with AI
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
            beautified_text = text
            if api_key:
                try:
                    from ..services import ai_generation
                    beautified_text = ai_generation.beautify_uploaded_content(api_key, text, type)
                except Exception as beau_err:
                    print(f"Beautification failed, falling back to raw: {beau_err}")

            # 4. Save to project
            update_data = {
                "extracted_content": text,
                type: beautified_text
            }
            service.update_project_data(project["id"], emp_code, update_data)

            return {"id": project["id"], "message": "Project imported successfully"}
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def upload_project(
    file: UploadFile = File(...),
    type: str = Form(...),
    title: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    return await upload_project_impl(file, type, title, current_user)

@alias_intake_router.post("/upload", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def upload_project_alias(
    file: UploadFile = File(...),
    type: str = Form(...),
    title: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    return await upload_project_impl(file, type, title, current_user)

MAX_STYLE_GUIDE_SIZE = 50 * 1024 * 1024  # 50 MB

async def upload_style_guide_pdf_impl(project_id: str, file: UploadFile, current_user: dict):
    ext = pathlib.Path(file.filename).suffix.lower()
    if ext != ".pdf":
        raise HTTPException(status_code=400, detail="Style guide must be a PDF file.")

    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    if len(content) > MAX_STYLE_GUIDE_SIZE:
        raise HTTPException(status_code=400, detail="Style guide PDF exceeds the 50 MB size limit.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            extracted_text = extraction_service.extract_text_from_pdf(f)

        if extracted_text.startswith("Error"):
            raise HTTPException(status_code=400, detail=f"Could not extract text from PDF: {extracted_text}")

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="The uploaded PDF appears to contain no readable text.")

        existing_intake = {}
        if project.get("intake_data"):
            try:
                existing_intake = json.loads(project["intake_data"])
            except json.JSONDecodeError:
                pass

        existing_intake["style_guide_pdf_text"] = extracted_text
        existing_intake["style_guide_pdf_name"] = file.filename

        service.update_project_data(
            project_id, emp_code,
            {"intake_data": json.dumps(existing_intake)}
        )

        return {
            "message": "Style guide uploaded and processed successfully.",
            "filename": file.filename,
            "extracted_length": len(extracted_text)
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@router.post("/{project_id}/style-guide", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def upload_style_guide_pdf(
    project_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    return await upload_style_guide_pdf_impl(project_id, file, current_user)

@alias_intake_router.post("/{project_id}/style-guide", dependencies=[Depends(require_permission(P.LEXAI_PROJECTS_MANAGE))])
async def upload_style_guide_pdf_alias(
    project_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    return await upload_style_guide_pdf_impl(project_id, file, current_user)

