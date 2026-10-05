"""
Phygitron 360 — Source Module: Candidates API
===============================================
Handles resume upload, candidate management, AI parsing, offer letter generation,
and ATS scoring for the Talent Vault (Source) module.
"""
import json
import os
import uuid
import logging
from typing import List, Optional, Any, Dict, Union
from datetime import datetime

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Query, Form
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
import os

from backend.core.database import DATA_DIR
from backend.core.dependencies import get_current_user, require_permission
from backend.modules.source.services.candidate_service import CandidateService
from backend.modules.source.services.candidate_report_service import generate_candidate_report_pdf
from backend.core.email_service_extended import send_generic_notification_email
from backend.modules.deploy.repositories.notification_repo import NotificationRepository
from backend.modules.deploy.services.notification_service import add_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/source/candidates", tags=["Source - Candidates"])

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ManualCandidateCreate(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    total_experience_years: float = 0
    current_designation: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    primary_skills: Optional[List[str]] = []
    secondary_skills: Optional[List[str]] = []


class CandidateUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    total_experience_years: Optional[float] = None
    current_designation: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    ai_summary: Optional[str] = None
    certifications: Optional[List[Any]] = None
    experience: Optional[List[dict]] = None
    education: Optional[List[dict]] = None
    primary_skills: Optional[List[str]] = None
    secondary_skills: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class StatusUpdate(BaseModel):
    status: str
    role_id: Optional[int] = None


class NoteCreate(BaseModel):
    content: str


class OfferPreviewRequest(BaseModel):
    salary: str
    role_title: str
    department: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None


class ConvertRequest(BaseModel):
    salary: str
    role_title: str
    department: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    offer_content: Optional[dict] = None


class SubfolderCreate(BaseModel):
    name: str
    month_year: str
    job_role_id: Optional[int] = None


class CandidateMoveRequest(BaseModel):
    candidate_ids: List[int]
    target_month: Optional[str] = None
    target_folder_id: Optional[int] = None

class NotificationRequest(BaseModel):
    subject: str
    message: str


class BulkTagRequest(BaseModel):
    candidate_ids: List[int]
    tags: List[str]
    action: str = "add"  # "add", "remove", or "set"


class CandidateTagsUpdate(BaseModel):
    tags: List[str]


class CandidateReportExportRequest(BaseModel):
    candidates: List[Dict[str, Any]]
    job_role_title: Optional[str] = None
    filters_summary: Optional[Dict[str, Any]] = None
    company_name: Optional[str] = "Phygitron 360"


class ReprocessCandidatesRequest(BaseModel):
    folder_id: Optional[int] = None
    month_year: Optional[str] = None
    candidate_ids: Optional[List[int]] = None
    all: Optional[bool] = False


# ---------------------------------------------------------------------------
def get_candidate_service(user=Depends(get_current_user)):
    return CandidateService(tenant_id=user.get('tenant_id', 'public'))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_and_parse_resume(
    file: UploadFile = File(...),
    tenant_id: str = Form("public"),
    override_date: Optional[str] = Form(None),
    folder_id: Optional[int] = Form(None),
    tags: Optional[str] = Form(None),
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Upload a single resume PDF/DOCX/TXT and run AI parse pipeline."""
    allowed_exts = (".pdf", ".docx", ".doc", ".txt", ".zip")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(allowed_exts)}")

    parsed_tags = []
    if tags:
        try:
            loaded = json.loads(tags)
            if isinstance(loaded, list):
                parsed_tags = [str(t).strip() for t in loaded if str(t).strip()]
            elif isinstance(loaded, str):
                parsed_tags = [t.strip() for t in loaded.split(",") if t.strip()]
        except Exception:
            parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    try:
        content = await file.read()
        result = await service.process_and_save_resume(content, file.filename, override_date=override_date, folder_id=folder_id, tags=parsed_tags)
        return {
            "success": True,
            "message": "Resume uploaded and parsed successfully",
            "data": result,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception(f"Resume upload failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while uploading the resume. Please try again.")

@router.get("/repository/folders", dependencies=[Depends(require_permission("source.candidates.view"))])
async def get_repository_folders(service: CandidateService = Depends(get_candidate_service)):
    """Get candidate count grouped by year and month for the repository view, including sub-folders."""
    try:
        folders = service.get_repository_folders()
        return {"success": True, "data": folders}
    except Exception as exc:
        logger.exception(f"Failed to fetch repository folders: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch folders.")

@router.post("/repository/subfolders", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def create_repository_subfolder(
    body: SubfolderCreate,
    service: CandidateService = Depends(get_candidate_service)
):
    """Create a sub-folder within a month folder by Job Role."""
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Sub-folder name is required.")
    if not body.month_year or len(body.month_year) != 7 or '-' not in body.month_year:
        raise HTTPException(status_code=400, detail="Invalid month_year format. Expected YYYY-MM.")
    try:
        folder = service.create_subfolder(body.name.strip(), body.month_year, body.job_role_id)
        return {"success": True, "message": "Sub-folder created successfully.", "data": folder}
    except Exception as exc:
        logger.exception(f"Failed to create subfolder: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create sub-folder.")

@router.get("/repository/all-subfolders", dependencies=[Depends(require_permission("source.candidates.view"))])
async def get_all_subfolders(service: CandidateService = Depends(get_candidate_service)):
    """Get all subfolders across all months (for dropdown selectors)."""
    try:
        subfolders = service.get_all_subfolders()
        return {"success": True, "data": subfolders}
    except Exception as exc:
        logger.exception(f"Failed to fetch all subfolders: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch sub-folders.")

@router.delete("/repository/subfolders/{folder_id}", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def delete_repository_subfolder(
    folder_id: int,
    service: CandidateService = Depends(get_candidate_service)
):
    """Delete a subfolder. Candidates in this subfolder will become unassigned."""
    try:
        success = service.delete_subfolder(folder_id)
        if not success:
            raise HTTPException(status_code=404, detail="Subfolder not found.")
        return {"success": True, "message": "Sub-folder deleted successfully."}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to delete subfolder: {exc}")
        raise HTTPException(status_code=500, detail="Failed to delete sub-folder.")

@router.post("/move", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def move_candidates(
    body: CandidateMoveRequest,
    service: CandidateService = Depends(get_candidate_service)
):
    """Move candidates to a different month and/or role sub-folder."""
    if not body.candidate_ids:
        raise HTTPException(status_code=400, detail="No candidates specified to move.")
    try:
        updated = service.move_candidates(
            candidate_ids=body.candidate_ids,
            target_month=body.target_month,
            target_folder_id=body.target_folder_id
        )
        return {
            "success": True,
            "message": f"Successfully moved {updated} candidate(s).",
            "data": {"moved_count": updated}
        }
    except Exception as exc:
        logger.exception(f"Failed to move candidates: {exc}")
        raise HTTPException(status_code=500, detail="Failed to move candidates.")

@router.post("/bulk-upload", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def bulk_upload_resumes(
    files: List[UploadFile] = File(...),
    override_date: Optional[str] = Form(None),
    folder_id: Optional[int] = Form(None),
    tags: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Process multiple resume files at once. Returns a job ID to track progress."""
    active_job = service.repo.get_active_bulk_upload_job()
    if active_job:
        raise HTTPException(status_code=400, detail="Another bulk upload is currently in progress. Please wait for it to finish or cancel it before starting a new one.")

    import tempfile
    import shutil
    import os
    
    parsed_tags = []
    if tags:
        try:
            loaded = json.loads(tags)
            if isinstance(loaded, list):
                parsed_tags = [str(t).strip() for t in loaded if str(t).strip()]
            elif isinstance(loaded, str):
                parsed_tags = [t.strip() for t in loaded.split(",") if t.strip()]
        except Exception:
            parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    files_data = []
    temp_dir = tempfile.mkdtemp(prefix="bulk_upload_")
    
    try:
        for f in files:
            temp_path = os.path.join(temp_dir, f.filename)
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(f.file, buffer)
            files_data.append((f.filename, temp_path))
            
        result = await service.bulk_upload_resumes(files_data, user.get("id"), temp_dir, override_date=override_date, folder_id=folder_id, tags=parsed_tags)
        return {
            "success": True,
            "data": result,
            "message": result.get("message", "Bulk upload queued.")
        }
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise e

@router.post("/reprocess", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def reprocess_candidates(
    payload: ReprocessCandidatesRequest,
    user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """
    Queue background job to re-extract skills and recalculate ATS scores
    for candidates in a folder, selected by IDs, or the entire repository.
    """
    active_job = service.repo.get_active_bulk_upload_job()
    if active_job:
        raise HTTPException(
            status_code=400,
            detail="Another background parsing job is currently in progress. Please wait for it to finish or cancel it before starting a new one."
        )

    result = await service.reprocess_candidates(
        folder_id=payload.folder_id,
        month_year=payload.month_year,
        candidate_ids=payload.candidate_ids,
        reprocess_all=bool(payload.all),
        user_id=user.get("id", 1)
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "No candidates found to reprocess."))

    return {
        "success": True,
        "data": result,
        "job_id": result.get("job_id"),
        "total_items": result.get("total_items"),
        "message": result.get("message")
    }

@router.get("/bulk-upload/active", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def get_active_bulk_upload(
    service: CandidateService = Depends(get_candidate_service)
):
    """Get the currently active bulk upload job, if any."""
    job = service.repo.get_active_bulk_upload_job()
    if not job:
        return {"success": True, "data": None}
    
    progress = service.repo.get_bulk_upload_job_progress(job["id"])
    return {
        "success": True,
        "data": progress
    }

@router.post("/bulk-upload/active/cancel", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def cancel_active_bulk_upload(
    service: CandidateService = Depends(get_candidate_service)
):
    """Cancel whatever bulk upload job is currently active or stuck."""
    from backend.core.database import get_db_connection
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            service.repo._set_search_path(cur)
            cur.execute("""
                UPDATE bulk_upload_job_items 
                SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                WHERE status IN ('pending', 'processing')
            """)
            cur.execute("""
                UPDATE bulk_upload_jobs 
                SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                WHERE status IN ('processing', 'extracting', 'paused')
            """)
            conn.commit()
    finally:
        conn.close()
    return {
        "success": True,
        "message": "All active or stuck bulk uploads cancelled."
    }

@router.get("/bulk-upload/{job_id}", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def get_bulk_upload_status(
    job_id: int,
    service: CandidateService = Depends(get_candidate_service)
):
    """Get the progress of a bulk upload job."""
    progress = service.repo.get_bulk_upload_job_progress(job_id)
    if not progress["job"]:
        raise HTTPException(status_code=404, detail="Bulk upload job not found")
        
    return {
        "success": True,
        "data": progress
    }

@router.post("/bulk-upload/{job_id}/cancel", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def cancel_bulk_upload(
    job_id: int,
    service: CandidateService = Depends(get_candidate_service)
):
    """Cancel a bulk upload job and stop further processing."""
    success = service.cancel_bulk_upload_job(job_id)
    return {
        "success": success,
        "message": "Job cancelled successfully."
    }


@router.post("/bulk-upload/{job_id}/pause", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def pause_bulk_upload(
    job_id: int,
    service: CandidateService = Depends(get_candidate_service)
):
    """Pause a bulk upload job."""
    success = service.pause_bulk_upload_job(job_id)
    return {
        "success": success,
        "message": "Job paused successfully."
    }


@router.post("/bulk-upload/{job_id}/resume", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def resume_bulk_upload(
    job_id: int, 
    user: dict = Depends(get_current_user)
):
    service = CandidateService(tenant_id=user.get("tenant_id"))
    success = service.resume_bulk_upload_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to resume bulk upload")
    return {"message": "Job resumed successfully"}

@router.post("/bulk-upload/{job_id}/retry-failed", dependencies=[Depends(require_permission("source.candidates.manage"))])
async def retry_failed_bulk_upload(
    job_id: int, 
    user: dict = Depends(get_current_user)
):
    service = CandidateService(tenant_id=user.get("tenant_id"))
    success = service.retry_failed_bulk_upload_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to retry bulk upload items")
    return {"message": "Failed items queued for retry"}


@router.post("/manual")
def create_manual_candidate(
    body: ManualCandidateCreate,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Create a candidate record from a manual entry form (no resume)."""
    try:
        actor_name = current_user.get("name") or current_user.get("username")
        candidate_id = service.create_manual_candidate(body.dict(), actor_name)
        return {"success": True, "message": "Candidate created successfully", "data": {"candidate_id": candidate_id}}
    except Exception as exc:
        logger.exception(f"Manual candidate creation failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while creating the candidate. Please try again.")


@router.get("/search")
def search_candidates(
    pool: Optional[str] = Query(None),          # all, candidate, trainee, employee
    location: Optional[str] = Query(None),
    min_exp: Optional[float] = Query(None),
    exp_range: Optional[str] = Query(None),     # fresher, 1-2, 2-5, 5+
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("newest"),   # newest, experience
    role_id: Optional[int] = Query(None),
    upload_time: Optional[List[str]] = Query(None),   # Multiple YYYY-MM
    folder_id: Optional[List[str]] = Query(None),     # Sub-folder ID(s) or 'unassigned'
    tag: Optional[str] = Query(None),                 # Tag name or 'untagged'
    tags: Optional[List[str]] = Query(None),          # Multiple tags
    limit: int = Query(50, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Advanced candidate search with optional ATS scoring against a job role."""
    try:
        results, total_count = service.search_candidates(
            pool=pool, location=location, min_exp=min_exp, exp_range=exp_range,
            search=search, sort_by=sort_by, role_id=role_id, upload_time=upload_time,
            folder_id=folder_id, tag=tag, tags=tags, limit=limit
        )
        return {"success": True, "data": results, "count": len(results), "total_count": total_count}
    except Exception as exc:
        logger.exception(f"search_candidates failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while searching candidates. Please try again.")


@router.get("/tags", dependencies=[Depends(require_permission("source.candidates.view"))])
def get_all_tags(service: CandidateService = Depends(get_candidate_service)):
    """Get all distinct tags with counts across candidates."""
    try:
        data = service.get_all_tags()
        return {"success": True, "data": data}
    except Exception as exc:
        logger.exception(f"Failed to fetch tags: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch tags.")


@router.post("/bulk-tag", dependencies=[Depends(require_permission("source.candidates.manage"))])
def bulk_tag_candidates(
    body: BulkTagRequest,
    service: CandidateService = Depends(get_candidate_service)
):
    """Bulk add, remove, or set tags on candidates."""
    try:
        updated = service.bulk_tag_candidates(body.candidate_ids, body.tags, action=body.action)
        return {"success": True, "message": f"Updated tags for {updated} candidate(s).", "count": updated}
    except Exception as exc:
        logger.exception(f"Failed to bulk tag candidates: {exc}")
        raise HTTPException(status_code=500, detail="Failed to update tags.")


@router.put("/{candidate_id}/tags", dependencies=[Depends(require_permission("source.candidates.manage"))])
def update_candidate_tags(
    candidate_id: int,
    body: CandidateTagsUpdate,
    service: CandidateService = Depends(get_candidate_service)
):
    """Update tags for a single candidate."""
    try:
        tags = service.update_candidate_tags(candidate_id, body.tags)
        return {"success": True, "data": tags, "message": "Tags updated successfully."}
    except Exception as exc:
        logger.exception(f"Failed to update candidate tags: {exc}")
        raise HTTPException(status_code=500, detail="Failed to update tags.")


@router.get("/active")
def list_active_candidates(
    current_user: dict = Depends(require_permission("source.candidates.view")),
    service: CandidateService = Depends(get_candidate_service)
):
    """List active candidates (those that have first_login or employee-type status)."""
    try:
        rows = service.get_active_candidates()
        return {"success": True, "data": rows, "count": len(rows)}
    except Exception as exc:
        logger.exception(f"Active candidates list failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while loading candidates. Please try again.")


@router.get("/activity")
def get_global_activity(
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(require_permission("source.candidates.view")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Get recent global activity logs across all candidates."""
    try:
        rows = service.get_global_activity(limit=limit)
        return {"success": True, "data": rows}
    except Exception as e:
        logger.exception(f"Failed to get global activity: {e}")
        raise HTTPException(status_code=500, detail="Something went wrong while loading recent activity. Please try again.")

@router.get("/my-applications")
def get_my_applications(
    current_user: dict = Depends(get_current_user),
    service: CandidateService = Depends(get_candidate_service)
):
    """Fetch all candidate applications linked to the logged-in employee."""
    try:
        user_id = current_user.get("id")
        if not user_id:
            return []
            
        repo = service.repo
        from backend.core.database import get_db_connection
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                repo._set_search_path(cur)
                cur.execute("""
                    SELECT c.id, c.full_name, c.email, c.status, c.created_at,
                           ci.status as invite_status, ci.email_sent_at,
                           COALESCE(jr_inv.title, jr_app.title) as job_title,
                           COALESCE(jr_inv.id, jr_app.id) as job_id
                    FROM candidates c
                    LEFT JOIN candidate_invites ci ON ci.candidate_id = c.id
                    LEFT JOIN job_roles jr_inv ON ci.job_role_id = jr_inv.id
                    LEFT JOIN candidate_applications ca ON ca.candidate_id = c.id
                    LEFT JOIN job_roles jr_app ON ca.job_role_id = jr_app.id
                    WHERE c.user_id = %s
                    ORDER BY c.created_at DESC
                """, (user_id,))
                columns = [desc[0] for desc in cur.description]
                results = [dict(zip(columns, row)) for row in cur.fetchall()]
                
                for r in results:
                    if r["created_at"] and hasattr(r["created_at"], "isoformat"):
                        r["created_at"] = r["created_at"].isoformat()
                    if r["email_sent_at"] and hasattr(r["email_sent_at"], "isoformat"):
                        r["email_sent_at"] = r["email_sent_at"].isoformat()
                return results
        finally:
            conn.close()
    except Exception as exc:
        logger.exception(f"get_my_applications failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while loading your applications. Please try again.")


@router.get("/{candidate_id}")
def get_candidate(
    candidate_id: int,
    role_id: Optional[int] = Query(None),
    current_user: dict = Depends(require_permission("source.candidates.view")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Full candidate profile with skills, notes, AI scores, and latest offer letter."""
    try:
        candidate = service.get_full_candidate_profile(candidate_id, role_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return {"success": True, "data": candidate}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"get_candidate failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while loading this candidate. Please try again.")


@router.put("/{candidate_id}")
def update_candidate(
    candidate_id: int,
    body: CandidateUpdate,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Manually update candidate details and skill taxonomy mapping."""
    try:
        actor_name = current_user.get("name") or current_user.get("username")
        success = service.update_candidate(candidate_id, body.dict(exclude_unset=True), actor_name)
        if not success:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return {"success": True, "message": "Candidate updated successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Failed to update candidate {candidate_id}: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while updating this candidate. Please try again.")


@router.get("/{candidate_id}/resume")
def get_candidate_resume(
    candidate_id: int,
    current_user: dict = Depends(require_permission("source.candidates.view")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Download the candidate's stored resume file."""
    candidate = service.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    row = candidate

    if not row or not row["resume_path"]:
        raise HTTPException(status_code=404, detail="Resume not found")

    file_path = row["resume_path"]

    # If the resume is stored in S3, generate a pre-signed URL (bucket is private)
    if file_path.startswith("https://") or file_path.startswith("http://"):
        from fastapi.responses import RedirectResponse
        from backend.common.services.storage_service import generate_presigned_url
        presigned = generate_presigned_url(file_path, expiry_seconds=900)  # 15 min
        return RedirectResponse(url=presigned)

    # Local disk fallback
    if not os.path.exists(file_path):
        import logging
        logging.getLogger(__name__).warning(
            f"Resume file not found on disk for candidate {candidate_id}: {file_path}"
        )
        raise HTTPException(
            status_code=404,
            detail=(
                "Resume file is no longer available. "
                "It may have been part of an older batch upload that was cleaned up. "
                "Please re-upload the resume to view it."
            )
        )

    media_type = None
    lower_path = file_path.lower()
    if lower_path.endswith(".pdf"):
        media_type = "application/pdf"
    elif lower_path.endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif lower_path.endswith(".doc"):
        media_type = "application/msword"
    elif lower_path.endswith(".txt"):
        media_type = "text/plain"

    return FileResponse(
        file_path, 
        filename=os.path.basename(file_path),
        media_type=media_type,
        content_disposition_type="inline"
    )


@router.put("/{candidate_id}/status")
def update_status(
    candidate_id: int,
    body: StatusUpdate,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Update a candidate's pipeline status."""
    updated = service.update_status(candidate_id, body.status, role_id=body.role_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Candidate not found")

    author = current_user.get("name") or current_user.get("username")
    service.repo.log_activity(candidate_id, author, "status_changed", f"Status changed to {body.status}")

    # Notify the candidate in-app if they have a user account
    try:
        candidate = service.get_candidate(candidate_id)
        if candidate and candidate.get('user_id'):
            status_messages = {
                'Shortlisted': 'Good news! Your profile has been shortlisted.',
                'Interview Scheduled': 'Your interview has been scheduled. Please check with the recruiter for details.',
                'Rejected': 'Thank you for your application. We have reviewed your profile and will keep it on file.',
                'Hired': 'Congratulations! You have been selected.',
                'Offered': 'An offer letter is being prepared for you.',
                'Assessment': 'You have been invited to complete an assessment. Please check your assignments.',
            }
            n_type = 'Success' if body.status in ('Hired', 'Offered', 'Shortlisted') else \
                     'Alert' if body.status == 'Rejected' else 'Info'
            add_notification(
                title=f"Application Update: {body.status}",
                message=status_messages.get(body.status, f'Your application status has been updated to: {body.status}.'),
                user_id=candidate['user_id'],
                n_type=n_type,
                tenant_id=current_user.get('tenant_id', 'public')
            )
    except Exception:
        pass  # Non-blocking

    return {"success": True, "message": "Status updated successfully"}


@router.post("/{candidate_id}/notes")
def add_note(
    candidate_id: int,
    body: NoteCreate,
    current_user: dict = Depends(require_permission("source.evaluations.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Add a note to the candidate's timeline."""
    author = current_user.get("name") or current_user.get("username")
    note = service.add_note(candidate_id, author, body.content)
    return {"success": True, "data": note}


@router.post("/{candidate_id}/offer-preview")
async def offer_preview(
    candidate_id: int,
    body: OfferPreviewRequest,
    current_user: dict = Depends(require_permission("source.offers.manage")),
    service: CandidateService = Depends(get_candidate_service),
):
    """
    Generate an AI offer letter preview for a candidate.
    Does NOT persist — returns content only.
    """
    tenant_id = current_user.get("tenant_id", "public")
    company = tenant_id.replace("tenant_", "").upper() if tenant_id != "public" else "Phygitron 360"
    
    hiring_details = {
        "role_title": body.role_title,
        "salary": body.salary,
        "department": body.department,
        "location": body.location,
        "start_date": body.start_date,
        "company": company,
    }
    
    preview = await service.generate_offer_preview(candidate_id, hiring_details)
    if not preview:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return {"success": True, "data": {"offer_content": preview}}


@router.post("/{candidate_id}/convert")
async def convert_to_offer(
    candidate_id: int,
    body: ConvertRequest,
    current_user: dict = Depends(require_permission("source.offers.manage")),
    service: CandidateService = Depends(get_candidate_service),
):
    """
    Create an offer letter (starts in 'pending' status).
    Moves candidate to 'Offered' status.
    """
    tenant_id = current_user.get("tenant_id", "public")
    company = tenant_id.replace("tenant_", "").upper() if tenant_id != "public" else "Phygitron 360"
    
    hiring_details = {
        "role_title": body.role_title,
        "salary": body.salary,
        "department": body.department,
        "location": body.location,
        "start_date": body.start_date,
        "company": company
    }
    
    try:
        await service.convert_to_offer(candidate_id, hiring_details, body.offer_content)

        # Notify the candidate in-app if they have a linked user account
        try:
            candidate = service.get_candidate(candidate_id)
            if candidate and candidate.get('user_id'):
                add_notification(
                    title="Offer Letter Prepared",
                    message=f"Congratulations! An offer letter for the role of {body.role_title} is being prepared for you.",
                    user_id=candidate['user_id'],
                    n_type="Success",
                    tenant_id=tenant_id
                )
        except Exception:
            pass  # Non-blocking

        return {"success": True, "message": "Offer letter created"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception(f"convert_to_offer failed for candidate {candidate_id}: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while creating the offer letter. Please try again.")


@router.delete("/{candidate_id}")
def delete_candidate(
    candidate_id: int,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Permanently delete a candidate and all related records."""
    try:
        deleted = service.delete_candidate(candidate_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return {"success": True, "message": "Candidate deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"delete_candidate({candidate_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while deleting this candidate. Please try again.")

class BulkDeleteRequest(BaseModel):
    candidate_ids: List[int]

@router.post("/bulk-delete")
def bulk_delete_candidates(
    req: BulkDeleteRequest,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Delete multiple candidates at once."""
    try:
        deleted_count = service.bulk_delete_candidates(req.candidate_ids)
        return {"success": True, "message": f"{deleted_count} candidates deleted", "deleted_count": deleted_count}
    except Exception as exc:
        logger.exception(f"bulk_delete_candidates failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while deleting these candidates. Please try again.")

@router.post("/{candidate_id}/notify")
def notify_candidate(
    candidate_id: int,
    payload: NotificationRequest,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """Send a custom HR notification to a candidate/trainee."""
    try:
        candidate = service.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        user_id = candidate.get("user_id")
        email = candidate.get("email")
        full_name = candidate.get("full_name") or "Candidate"
        company_name = current_user.get("company_name", "Phygitron 360")
        tenant_id = current_user.get("tenant_id", "public")

        if not email:
            raise HTTPException(status_code=400, detail="Candidate does not have an email address.")
        
        # 1. Send Email
        sent = send_generic_notification_email(
            to_email=email,
            candidate_name=full_name,
            notification_subject=payload.subject,
            notification_message=payload.message,
            company_name=company_name
        )
        if not sent:
            raise HTTPException(status_code=500, detail="Failed to dispatch email.")

        # 2. Save Notification to Database
        if user_id:
            repo = NotificationRepository()
            repo.create_notification(
                employee_code=None,
                user_id=user_id,
                title=payload.subject,
                message=payload.message,
                n_type="CandidateUpdate",
                tenant_id=tenant_id
            )

        return {"success": True, "message": "Notification sent and logged."}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"notify_candidate({candidate_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while sending this notification. Please try again.")



# ---------------------------------------------------------------------------
# Employee revert (testing utility)
# ---------------------------------------------------------------------------

@router.post("/employees/{employee_id}/revert")
def revert_employee_to_candidate(
    employee_id: int,
    current_user: dict = Depends(require_permission("source.candidates.manage")),
    service: CandidateService = Depends(get_candidate_service)
):
    """
    Revert an employee back to candidate status.
    Testing/correction utility — restores candidate status to 'New' and clears employee link.
    """
    try:
        reverted = service.revert_employee(employee_id)
        if not reverted:
            raise HTTPException(status_code=404, detail="Candidate/employee not found")
        return {"success": True, "message": "Reverted to candidate status", "data": {"candidate_id": employee_id}}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"revert_employee_to_candidate({employee_id}) failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong while reverting this employee. Please try again.")


# ---------------------------------------------------------------------------
# Candidate Report Export (Executive PDF)
# ---------------------------------------------------------------------------

@router.post("/export-report-pdf", dependencies=[Depends(require_permission("source.candidates.view"))])
def export_candidate_report_pdf(
    payload: CandidateReportExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate and download an executive landscape PDF report for the given candidates.
    """
    try:
        company_name = payload.company_name or current_user.get("company_name") or "Phygitron 360"
        pdf_bytes = generate_candidate_report_pdf(
            candidates=payload.candidates,
            job_role_title=payload.job_role_title,
            filters_summary=payload.filters_summary,
            company_name=company_name
        )
        safe_role = (payload.job_role_title or "Shortlist").replace(" ", "_").replace("/", "_")
        safe_date = datetime.utcnow().strftime("%Y%m%d")
        filename = f"Candidate_Report_{safe_role}_{safe_date}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as exc:
        logger.exception(f"export_candidate_report_pdf failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(exc)}")

