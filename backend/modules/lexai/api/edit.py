import os
from fastapi import APIRouter, Depends, HTTPException
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from .. import schemas
from ..services.project_service import ProjectService
from ..services import ai_editing
from ..repositories.project_repo import LexAIProjectRepository

router = APIRouter(prefix="/api/lexai/edit", tags=["lexai-edit"])
alias_edit_router = APIRouter(prefix="/api/edit", tags=["lexai-edit-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_repo(current_user: dict) -> LexAIProjectRepository:
    return LexAIProjectRepository()

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

def ai_chat_edit_impl(request: schemas.DocumentEditRequest, project_id: str, current_user: dict):
    service = get_service(current_user)
    repo = get_repo(current_user)
    tenant_id = current_user.get('tenant_id', 'public')
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI API Key is missing.")

    chat_history_db = repo.get_chat_messages(tenant_id, project_id, request.doc_type)
    chat_history = [{"role": msg["role"], "content": msg["content"]} for msg in chat_history_db]

    # Save user message
    repo.add_chat_message(tenant_id, project_id, request.doc_type, "user", request.user_prompt)

    # Call AI
    response = ai_editing.ai_edit_document(
        api_key,
        request.current_content,
        request.user_prompt,
        request.doc_type,
        chat_history,
        selected_text=request.selected_text,
        selected_screen_num=request.selected_screen_num,
        selected_col_index=request.selected_col_index,
        selected_col_name=request.selected_col_name,
        file_context=request.file_context
    )

    # Save assistant message
    repo.add_chat_message(tenant_id, project_id, request.doc_type, "assistant", response.get("assistant_reply", ""))

    return response

@router.post("/chat", dependencies=[Depends(require_permission(P.LEXAI_DESIGN_RUN))])
def ai_chat_edit(request: schemas.DocumentEditRequest, project_id: str, current_user: dict = Depends(get_current_user)):
    return ai_chat_edit_impl(request, project_id, current_user)

@alias_edit_router.post("/chat", dependencies=[Depends(require_permission(P.LEXAI_DESIGN_RUN))])
def ai_chat_edit_alias(request: schemas.DocumentEditRequest, project_id: str, current_user: dict = Depends(get_current_user)):
    return ai_chat_edit_impl(request, project_id, current_user)

def save_inline_edit_impl(doc_type: str, content: dict, project_id: str, current_user: dict):
    service = get_service(current_user)
    emp_code = get_emp_code(current_user)

    project = service.get_project(project_id, emp_code)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    doc_type_lower = doc_type.lower()
    field_to_update = None
    if "intake" in doc_type_lower:
        field_to_update = "intake_data"
    elif "design" in doc_type_lower:
        field_to_update = "design_doc"
    elif "storyboard" in doc_type_lower:
        field_to_update = "storyboard"
    else:
        raise HTTPException(status_code=400, detail="Unsupported document type")

    service.update_project_data(project_id, emp_code, {field_to_update: content.get('content')})
    return {"message": "Saved successfully"}

@router.post("/save-inline", dependencies=[Depends(require_permission(P.LEXAI_DESIGN_RUN))])
def save_inline_edit(doc_type: str, content: dict, project_id: str, current_user: dict = Depends(get_current_user)):
    return save_inline_edit_impl(doc_type, content, project_id, current_user)

@alias_edit_router.post("/save-inline", dependencies=[Depends(require_permission(P.LEXAI_DESIGN_RUN))])
def save_inline_edit_alias(doc_type: str, content: dict, project_id: str, current_user: dict = Depends(get_current_user)):
    return save_inline_edit_impl(doc_type, content, project_id, current_user)
