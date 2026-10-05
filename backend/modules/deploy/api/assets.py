from fastapi import APIRouter, HTTPException, Depends, Body
from backend.core.dependencies import get_current_user, require_permission
from backend.modules.deploy.services.asset_service import AssetService
from backend.modules.deploy.schemas.asset import AssetChecklist
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets", tags=["assets"])

def get_service(user=Depends(get_current_user)):
    return AssetService(tenant_id=user.get('tenant_id', 'public'))

def check_asset_access(employee_code: str, current_user: dict, required_manage: bool = False):
    roles = current_user.get("roles") or [current_user.get("role")]
    roles = [r.lower() for r in roles if r]
    if "super_admin" in roles or "superadmin" in roles:
        return
        
    perms = current_user.get("permissions", {})
    if isinstance(perms, dict):
        has_manage = perms.get("deploy.assets.manage_onboarding", False) or perms.get("deploy.assets.manage_clearance", False)
        has_view_all = perms.get("deploy.assets.view_all", False)
        has_view_personal = perms.get("deploy.assets.view_personal", False)
    else:
        has_manage = "deploy.assets.manage_onboarding" in perms or "deploy.assets.manage_clearance" in perms
        has_view_all = "deploy.assets.view_all" in perms
        has_view_personal = "deploy.assets.view_personal" in perms
        
    if required_manage:
        if not has_manage:
            logger.warning(
                "Asset access denied for user %s: missing manage clearance",
                current_user.get("employee_code") or current_user.get("email") or "unknown",
            )
            raise HTTPException(status_code=403, detail="You don't have permission to do this. Contact your admin if you think this is a mistake.")
        return

    if has_view_all:
        return

    if has_view_personal and current_user.get("employee_code") == employee_code:
        return

    logger.warning(
        "Asset access denied for user %s: missing view clearance for %s",
        current_user.get("employee_code") or current_user.get("email") or "unknown",
        employee_code,
    )
    raise HTTPException(status_code=403, detail="You don't have permission to view this employee's assets.")

@router.get("/{employee_code}")
def get_asset_checklist(employee_code: str, service: AssetService = Depends(get_service), current_user: dict = Depends(get_current_user)):
    check_asset_access(employee_code, current_user, required_manage=False)
    try:
        return service.get_checklist(employee_code)
    except Exception as e:
        logger.exception("Failed to fetch asset checklist for %s: %s", employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while fetching the asset checklist. Please try again.")

@router.put("/{employee_code}")
def upsert_asset_checklist(employee_code: str, data: dict = Body(...), service: AssetService = Depends(get_service), current_user: dict = Depends(get_current_user)):
    check_asset_access(employee_code, current_user, required_manage=True)
    # Using generic dict for body to allow flexibility, but we could use AssetChecklist schema
    try:
        return service.upsert_checklist(employee_code, data)
    except Exception as e:
        logger.exception("Failed to save asset checklist for %s: %s", employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while saving the asset checklist. Please try again.")
