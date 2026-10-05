from fastapi import APIRouter, Depends
from backend.core.dependencies import get_current_user, require_permission, require_module
from backend.modules.admin.services.org_service import OrgService

router = APIRouter(prefix="/api/org", tags=["Org Admin"])

def get_service(current_user: dict = Depends(get_current_user)):
    return OrgService(tenant_id=current_user.get("tenant_id", "public"))

_deploy_access = [Depends(require_module("deploy"))]

@router.get("/dashboard-stats", dependencies=_deploy_access)
def get_stats(service: OrgService = Depends(get_service)):
    return service.get_dashboard_stats()

@router.get("/pipeline-funnel", dependencies=_deploy_access)
def get_funnel(service: OrgService = Depends(get_service)):
    return service.get_pipeline_funnel()

@router.get("/module-health", dependencies=_deploy_access)
def get_health(service: OrgService = Depends(get_service)):
    return service.get_module_health()

@router.get("/recent-activity", dependencies=_deploy_access)
def get_activity(service: OrgService = Depends(get_service)):
    return service.get_recent_activity()

@router.get("/journey-overview", dependencies=_deploy_access)
def get_journeys(service: OrgService = Depends(get_service)):
    return service.get_journey_overview()

@router.get("/team-overview", dependencies=_deploy_access)
def get_team(service: OrgService = Depends(get_service)):
    return service.get_team_overview()

@router.get("/alerts", dependencies=_deploy_access)
def get_alerts(service: OrgService = Depends(get_service)):
    return service.get_alerts()

@router.get("/billing-status", dependencies=_deploy_access)
def get_billing(service: OrgService = Depends(get_service)):
    return service.get_billing_status()
