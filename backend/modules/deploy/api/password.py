from fastapi import APIRouter, HTTPException, Depends, Body
from backend.modules.deploy.services.password_service import PasswordService
from backend.core.dependencies import get_current_user, require_permission, P
from pydantic import BaseModel, EmailStr
import logging

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/auth", tags=["password-reset"])


# Pydantic models
class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    workspace_id: str = "public"


class VerifyTokenRequest(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class AdminResetRequest(BaseModel):
    employee_code: str
    reset_type: str  # 'temp_password' or 'reset_link'


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def get_service(tenant_id: str = 'public'):
    """Create PasswordService bound to the given tenant."""
    return PasswordService(tenant_id=tenant_id)


@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
):
    """
    User requests password reset (forgot password).
    Always returns success to prevent email enumeration.
    """
    try:
        # Sanitize workspace_id: fallback to public if empty, invalid, or technical subdomain
        workspace_id = (request.workspace_id or "public").strip().lower()
        if workspace_id in ["localhost", "127.0.0.1", "app", "api", "admin", "www", "null", "undefined"] or workspace_id.replace(".", "").isdigit():
            workspace_id = "public"
            
        # Resolve subdomain to actual tenant schema ID
        tenant_context = workspace_id
        if tenant_context != 'public' and not tenant_context.startswith('tenant_'):
            from backend.core.database import get_db_connection
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SET search_path TO public")
                    cur.execute("SELECT id FROM tenants WHERE subdomain = %s", (tenant_context,))
                    row = cur.fetchone()
                    if row:
                        tenant_context = row[0]
                    else:
                        tenant_context = "public"
            finally:
                conn.close()

        # Instantiate service with the resolved tenant so portal_url is correct
        service = get_service(tenant_id=tenant_context)
        result = service.request_password_reset(str(request.email).strip().lower(), tenant_context)
        return result
    except Exception as e:
        logger.exception("Failed to process forgot-password request: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while processing your request. Please try again.")


@router.post("/verify-reset-token")
@router.get("/verify-reset-token")
def verify_reset_token(
    request: VerifyTokenRequest = None,
    token: str = None,
    service: PasswordService = Depends(get_service)
):
    """Verify if password reset token is valid"""
    raw_token = (request.token if request else None) or token
    if not raw_token:
        raise HTTPException(status_code=400, detail="Token required")
    try:
        result = service.verify_reset_token(raw_token)
        if not result['valid']:
            raise HTTPException(status_code=400, detail=result['message'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to verify password reset token: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while verifying this link. Please try again.")


@router.post("/verify-token")
@router.get("/verify-token")
def generic_verify_token(
    request_data: dict = Body(default={}),
    token: str = None
):
    """Fallback handler for generic verify-token on /api/auth. Supports both password reset and onboarding tokens."""
    raw_token = token or (request_data.get("token") if isinstance(request_data, dict) else None)
    if not raw_token:
        raise HTTPException(status_code=400, detail="Token required")
    raw_token = str(raw_token).strip()

    # 1. Try password reset token
    try:
        token_tenant = 'public'
        if ':' in raw_token:
            token_tenant = raw_token.split(':', 1)[0]
        service = get_service(tenant_id=token_tenant)
        result = service.verify_reset_token(raw_token)
        if result.get('valid'):
            return result
    except Exception:
        pass

    # 2. Try onboarding invite token
    try:
        from backend.modules.deploy.services.onboarding_service import OnboardingService
        onb_service = OnboardingService(tenant_id='public')
        return onb_service.verify_token(raw_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to verify token: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while verifying this link. Please try again.")


@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
):
    """Reset password using token — tenant is encoded in the token itself"""
    try:
        # Extract tenant from the token prefix (format: tenant_id:raw_token)
        token_tenant = 'public'
        if ':' in request.token:
            token_tenant = request.token.split(':', 1)[0]
        service = get_service(tenant_id=token_tenant)
        result = service.reset_password(request.token, request.new_password)
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to reset password: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while resetting your password. Please try again.")


@router.post("/admin-reset-password", dependencies=[Depends(require_permission([P.DEPLOY_EMP_EDIT_BASIC, P.ADMIN_USERS_MANAGE]))])
def admin_reset_password(
    request: AdminResetRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Admin/HR resets employee password.
    Returns temp password or sends reset link based on reset_type.
    """
    try:
        admin_email = current_user.get('username', 'Admin')
        tenant_id = current_user.get('tenant_id', 'public')
        service = get_service(tenant_id=tenant_id)
        result = service.admin_reset_password(
            employee_code=request.employee_code,
            reset_type=request.reset_type,
            admin_email=admin_email,
            tenant_id=tenant_id
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to admin-reset password for %s: %s", request.employee_code, e)
        raise HTTPException(status_code=500, detail="Something went wrong while resetting this employee's password. Please try again.")


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """Change password for logged-in user"""
    try:
        email = current_user.get('username')
        if not email:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        tenant_id = current_user.get('tenant_id', 'public')
        service = get_service(tenant_id=tenant_id)
        result = service.change_password_logged_in(
            email=email,
            current_password=request.current_password,
            new_password=request.new_password,
            tenant_id=tenant_id
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to change password: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while changing your password. Please try again.")


@router.get("/check-must-change-password")
def check_must_change_password(
    current_user: dict = Depends(get_current_user),
):
    """Check if user must change password"""
    try:
        email = current_user.get('username')
        tenant_id = current_user.get('tenant_id', 'public')
        service = get_service(tenant_id=tenant_id)
        must_change = service.check_must_change_password(email, tenant_id=tenant_id)
        return {"must_change": must_change}
    except Exception as e:
        logger.exception("Failed to check must-change-password status: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong while checking your account status. Please try again.")
