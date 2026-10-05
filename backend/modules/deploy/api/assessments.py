from fastapi import APIRouter, HTTPException, Depends
from backend.modules.deploy.services.assessment_service import AssessmentService
from backend.core.dependencies import get_current_user, require_permission
from backend.modules.deploy.schemas.assessment import SaveAssessmentRequest, RequestAssessmentRequest
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessments", tags=["Performance Metrics"])

def get_service(user=Depends(get_current_user)):
    return AssessmentService(tenant_id=user.get('tenant_id', 'public'))

@router.get("/{employee_code}/{year}", dependencies=[Depends(require_permission("deploy.performance.view_personal"))])
def get_assessments(employee_code: str, year: int, user=Depends(get_current_user), service: AssessmentService = Depends(get_service)):
    try:
        # service handles authorization (will be updated soon to use perms object)
        return service.get_assessments(employee_code, year, user)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.exception("Failed to fetch assessments for employee %s (%s): %s", employee_code, year, e)
        raise HTTPException(status_code=500, detail="Something went wrong while fetching assessments. Please try again.")

@router.post("/save", dependencies=[Depends(require_permission("deploy.performance.submit_self_rating"))])
def save_assessment(req: SaveAssessmentRequest, user=Depends(get_current_user), service: AssessmentService = Depends(get_service)):
    try:
        return service.save_assessment(req, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to save assessment: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while saving this assessment. Please try again.")

@router.post("/request", dependencies=[Depends(require_permission("deploy.performance.manage_assessments"))])
def request_review(req: RequestAssessmentRequest, user=Depends(get_current_user), service: AssessmentService = Depends(get_service)):
    return service.request_review(req.employee_code, req.year, req.period_type, req.period_value)
