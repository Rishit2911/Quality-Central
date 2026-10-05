from fastapi import APIRouter, Depends, HTTPException
from backend.core.dependencies import require_permission, get_current_user, P
from backend.modules.deploy.services.dashboard_service import DashboardService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

def get_service():
    return DashboardService()

@router.get("/stats", dependencies=[Depends(require_permission([
    P.DEPLOY_ANALYTICS_VIEW_KPIS, 
    P.DEPLOY_ANALYTICS_VIEW_STATUS, 
    P.DEPLOY_ANALYTICS_VIEW_HIRING, 
    P.DEPLOY_ANALYTICS_VIEW_DEMO, 
    P.DEPLOY_ANALYTICS_VIEW_TALENT
]))])
def get_dashboard_stats(current_user: dict = Depends(get_current_user), service: DashboardService = Depends(get_service)):
    try:
        tenant_id = current_user.get("tenant_id", "public")
        return service.get_admin_stats(tenant_id=tenant_id)
    except Exception as e:
        logger.exception("Failed to fetch admin dashboard stats: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while loading the dashboard. Please try again.")

@router.get("/employee-stats", dependencies=[Depends(require_permission("module.deploy.access"))])
def get_employee_dashboard_stats(current_user: dict = Depends(get_current_user), service: DashboardService = Depends(get_service)):
    employee_code = current_user.get("employee_code")
    if not employee_code:
        return {"error": "No employee code found for user"}

    try:
        tenant_id = current_user.get("tenant_id", "public")
        return service.get_employee_stats(employee_code, tenant_id=tenant_id)
    except Exception as e:
        logger.exception("Failed to fetch employee dashboard stats for %s: %s", employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while loading your dashboard. Please try again.")
