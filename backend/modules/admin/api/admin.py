import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from backend.core.dependencies import require_permission, get_current_user
from backend.modules.admin.services.admin_service import AdminService
from backend.modules.admin.schemas.admin import (
    UserCreate, UserResponse, LogResponse, RolePermissionsUpdate,
    UserOverrideUpdate, RoleUpdate, PermissionTemplateCreate, PermissionTemplateRename
)
from backend.modules.deploy.services.notification_service import add_notification

logger = logging.getLogger(__name__)

class ProvisionTenantRequest(BaseModel):
    company_name: str
    admin_email: str
    admin_password: str

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_permission("admin.users.manage"))])

def get_service(current_user: dict = Depends(get_current_user)):
    return AdminService(tenant_id=current_user.get('tenant_id', 'public'))

@router.get("/users", response_model=List[UserResponse])
def list_users(service: AdminService = Depends(get_service)):
    return service.list_users()

@router.get("/tenants")
def list_tenants(service: AdminService = Depends(get_service)):
    return service.list_tenants()

@router.post("/tenants", dependencies=[Depends(require_permission("admin.tenants.provision"))])
def provision_tenant(data: ProvisionTenantRequest, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.provision_tenant(data.company_name, data.admin_email, data.admin_password, current_user['username'])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to provision tenant %s: %s", data.company_name, e)
        raise HTTPException(status_code=500, detail="Something went wrong while provisioning the tenant. Please try again.")

@router.delete("/tenants/{tenant_id}", dependencies=[Depends(require_permission("admin.tenants.provision"))])
def delete_tenant(tenant_id: str, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.delete_tenant(tenant_id, current_user['username'])
    except Exception as e:
        logger.exception("Failed to delete tenant %s: %s", tenant_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while deleting the tenant. Please try again.")

@router.post("/users")
def add_new_user(user: UserCreate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.create_user(user.username, user.password, user.role, current_user['username'], current_user['role'], user.employee_code, user.custom_roles)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create user %s: %s", user.username, e)
        raise HTTPException(status_code=500, detail="Something went wrong while creating the user. Please try again.")

@router.delete("/users/{user_id}")
def delete_existing_user(user_id: int, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.delete_user(user_id, current_user['username'])
    except ValueError as e:
        if "not found" in str(e).lower():
             raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to delete user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while deleting the user. Please try again.")

@router.get("/logs", response_model=List[LogResponse])
def view_logs(service: AdminService = Depends(get_service)):
    return service.get_logs()

@router.get("/permissions/roles")
def get_role_permissions(service: AdminService = Depends(get_service)):
    return service.get_role_permissions()

@router.post("/permissions/roles")
def update_role_permissions(update: RolePermissionsUpdate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.update_role_permissions(update.role, update.permissions, current_user['username'])
    except Exception as e:
        logger.exception("Failed to update role permissions for role %s: %s", update.role, e)
        raise HTTPException(status_code=500, detail="Something went wrong while updating role permissions. Please try again.")

@router.get("/permissions/templates")
def get_templates(service: AdminService = Depends(get_service)):
    return service.get_templates()

@router.post("/permissions/templates")
def create_template(data: PermissionTemplateCreate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.create_template(data.name, data.description, current_user['username'])
    except Exception as e:
        logger.exception("Failed to create permission template %s: %s", data.name, e)
        raise HTTPException(status_code=500, detail="Something went wrong while creating the permission template. Please try again.")

@router.delete("/permissions/templates/{name}")
def delete_template(name: str, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.delete_template(name, current_user['username'])
    except Exception as e:
        logger.exception("Failed to delete permission template %s: %s", name, e)
        raise HTTPException(status_code=500, detail="Something went wrong while deleting the permission template. Please try again.")

@router.put("/permissions/templates/{name}")
def rename_template(name: str, data: PermissionTemplateRename, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.rename_template(name, data.new_name, current_user['username'])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to rename permission template %s: %s", name, e)
        raise HTTPException(status_code=500, detail="Something went wrong while renaming the permission template. Please try again.")

@router.get("/permissions/users/{user_id}")
def get_user_overrides(user_id: int, service: AdminService = Depends(get_service)):
    return service.get_user_overrides(user_id)

@router.post("/permissions/users/{user_id}")
def update_user_overrides(user_id: int, update: UserOverrideUpdate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    try:
        return service.update_user_overrides(user_id, update.overrides, current_user['username'])
    except Exception as e:
        logger.exception("Failed to update permission overrides for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while updating user permissions. Please try again.")

class EmployeeCodeUpdate(BaseModel):
    employee_code: Optional[str] = None

@router.patch("/users/{user_id}/employee-code")
def update_user_employee_code(
    user_id: int,
    data: EmployeeCodeUpdate,
    current_user: dict = Depends(get_current_user),
    service: AdminService = Depends(get_service)
):
    try:
        return service.update_employee_code(user_id, data.employee_code, current_user['username'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to update employee code for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while updating the employee code. Please try again.")

@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    data: RoleUpdate,
    current_user: dict = Depends(get_current_user),
    service: AdminService = Depends(get_service)
):
    try:
        result = service.update_role(user_id, data.role, current_user['username'], current_user['role'], data.templates)
        # Notify the affected user about their role change
        add_notification(
            title="Role Updated",
            message=f"Your platform role has been updated to: {data.role}. Your permissions may have changed.",
            user_id=user_id,
            n_type="Info",
            tenant_id=current_user.get('tenant_id', 'public')
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to update role for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while updating the user's role. Please try again.")

class ToggleActiveUpdate(BaseModel):
    is_active: bool

@router.patch("/users/{user_id}/toggle")
def toggle_user_active(
    user_id: int,
    data: ToggleActiveUpdate,
    current_user: dict = Depends(get_current_user),
    service: AdminService = Depends(get_service)
):
    try:
        result = service.toggle_user_active(user_id, data.is_active, current_user['username'], current_user['role'])
        # Notify the affected user of their account status change
        status_label = "activated" if data.is_active else "deactivated"
        add_notification(
            title=f"Account {status_label.capitalize()}",
            message=f"Your account has been {status_label} by an administrator.",
            user_id=user_id,
            n_type="Success" if data.is_active else "Alert",
            tenant_id=current_user.get('tenant_id', 'public')
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to toggle active status for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Something went wrong while updating the account status. Please try again.")

class TenantOpsUpdate(BaseModel):
    company_name: Optional[str] = None
    modules_enabled: Optional[List[str]] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/tenants/{tenant_id}/ops")
def get_tenant_ops(tenant_id: str, service: AdminService = Depends(get_service)):
    if tenant_id == 'current':
        return service.get_tenant_ops(service.tenant_id)
    return service.get_tenant_ops(tenant_id)

@router.patch("/tenants/{tenant_id}/ops")
def update_tenant_ops(tenant_id: str, data: TenantOpsUpdate, current_user: dict = Depends(get_current_user), service: AdminService = Depends(get_service)):
    target_id = service.tenant_id if tenant_id == 'current' else tenant_id
    return service.update_tenant_ops(target_id, data.dict(exclude_none=True), current_user['username'])
