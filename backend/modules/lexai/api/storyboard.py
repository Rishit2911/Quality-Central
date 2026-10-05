import os
import json
import time
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from backend.core.dependencies import get_current_user, require_permission
from backend.core.permissions import P
from ..services.project_service import ProjectService
from ..services import ai_generation

router = APIRouter(prefix="/api/lexai/storyboard", tags=["lexai-storyboard"])
alias_storyboard_router = APIRouter(prefix="/api/storyboard", tags=["lexai-storyboard-alias"])

def get_service(current_user: dict) -> ProjectService:
    tenant_id = current_user.get('tenant_id', 'public')
    return ProjectService(tenant_id=tenant_id)

def get_emp_code(current_user: dict) -> str:
    return current_user.get('employee_code') or current_user.get('email') or str(current_user.get('id', 'unknown'))

def generate_storyboard_stream_impl(project_id: str, storyboard_type: str, current_user: dict):
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
    design_doc = project.get("design_doc") or ""

    is_uploaded_regen = bool(content and not design_doc)

    if not design_doc and not is_uploaded_regen:
        raise HTTPException(status_code=400, detail="Cannot generate storyboard without an approved Design Document.")

    if is_uploaded_regen:
        def upload_event_stream():
            yield f"data: {json.dumps({'type': 'progress', 'current': 1, 'total': 1, 'status': 'Re-formatting uploaded storyboard...'})}\n\n"
            try:
                new_sb = ai_generation.beautify_uploaded_content(api_key, content, "storyboard", storyboard_type)
                service.update_project_data(project_id, emp_code, {"storyboard": new_sb})
                yield f"data: {json.dumps({'type': 'complete', 'storyboard': new_sb})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        return StreamingResponse(upload_event_stream(), media_type="text/event-stream")

    client = ai_generation.genai.Client(api_key=api_key)
    strategies = ai_generation.get_strategy_for_level(intake_data.get('interactivity_level', ''))
    num_modules = int(intake_data.get('num_modules', 3))
    generate_fn = ai_generation._generate_single_module_type1 if storyboard_type == "Type 1" else ai_generation._generate_single_module_type2

    def event_stream():
        course_title = intake_data.get('course_title', 'Untitled Course')
        all_modules = [f"# STORYBOARD — {course_title}\n"]

        for i in range(1, num_modules + 1):
            progress_data = json.dumps({"type": "progress", "current": i, "total": num_modules, "status": f"Generating Module {i} of {num_modules}..."})
            yield f"data: {progress_data}\n\n"

            try:
                module_content = ai_generation._call_module_with_retry(
                    generate_fn, client, i, num_modules, design_doc, intake_data, content, strategies
                )
                all_modules.append(module_content)

                complete_data = json.dumps({"type": "module_done", "current": i, "total": num_modules, "status": f"Module {i} of {num_modules} complete ✓"})
                yield f"data: {complete_data}\n\n"
            except Exception as e:
                error_data = json.dumps({"type": "error", "message": f"Error generating module {i}: {str(e)}"})
                yield f"data: {error_data}\n\n"
                return

            if i < num_modules:
                time.sleep(2)

        full_storyboard = "\n\n---\n\n".join(all_modules)
        service.update_project_data(project_id, emp_code, {"storyboard": full_storyboard})

        final_data = json.dumps({"type": "complete", "storyboard": full_storyboard})
        yield f"data: {final_data}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.post("/{project_id}/generate", dependencies=[Depends(require_permission(P.LEXAI_STORYBOARD_RUN))])
def generate_storyboard_stream(project_id: str, storyboard_type: str = "Type 1", current_user: dict = Depends(get_current_user)):
    return generate_storyboard_stream_impl(project_id, storyboard_type, current_user)

@alias_storyboard_router.post("/{project_id}/generate", dependencies=[Depends(require_permission(P.LEXAI_STORYBOARD_RUN))])
def generate_storyboard_stream_alias(project_id: str, storyboard_type: str = "Type 1", current_user: dict = Depends(get_current_user)):
    return generate_storyboard_stream_impl(project_id, storyboard_type, current_user)
