import uuid
import secrets
import string
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from backend.modules.deploy.repositories.password_repo import PasswordResetRepository
from backend.common.services.email_service import EmailService
from passlib.hash import pbkdf2_sha256
import os


class PasswordService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = PasswordResetRepository()
        self.email_service = EmailService(tenant_id=tenant_id)
    
    def generate_temp_password(self, length: int = 12) -> str:
        """Generate a secure temporary password"""
        # Mix of uppercase, lowercase, digits, and special chars
        chars = string.ascii_letters + string.digits + "!@#$%"
        password = ''.join(secrets.choice(chars) for _ in range(length))
        # Ensure it has at least one of each type
        if not any(c.isupper() for c in password):
            password = password[:-1] + secrets.choice(string.ascii_uppercase)
        if not any(c.isdigit() for c in password):
            password = password[:-2] + secrets.choice(string.digits) + password[-1]
        if not any(c in "!@#$%" for c in password):
            password = password[:-3] + secrets.choice("!@#$%") + password[-2:]
        return password
    
    def request_password_reset(self, email: str, tenant_id: str = "public") -> Dict[str, Any]:
        """
        User requests password reset (forgot password).
        Always returns success to prevent email enumeration.
        """
        email = str(email or "").strip().lower()
        success_message = "If an account exists with this email, a password reset link has been sent."
        
        try:
            # Check if user exists in the specified tenant
            user = self.repo.get_user_by_email(email, tenant_id=tenant_id)
            target_tenant = tenant_id

            # If not found in public, search active tenant schemas
            if not user and tenant_id == 'public':
                from backend.core.database import get_db_connection
                conn = get_db_connection()
                try:
                    with conn.cursor() as cur:
                        cur.execute("SET search_path TO public")
                        cur.execute("SELECT id FROM tenants")
                        tenants = cur.fetchall()
                        for (t_id,) in tenants:
                            t_user = self.repo.get_user_by_email(email, tenant_id=t_id)
                            if t_user:
                                user = t_user
                                target_tenant = t_id
                                break
                finally:
                    conn.close()

            if not user:
                return {"success": True, "message": success_message}
            
            # Generate reset token
            raw_token = str(uuid.uuid4())
            token = f"{target_tenant}:{raw_token}"
            expires_at = datetime.now() + timedelta(hours=1)
            
            # Invalidate any existing tokens for this email in target tenant
            self.repo.invalidate_existing_tokens(email, tenant_id=target_tenant)
            
            # Create new token in target tenant
            self.repo.create_reset_token({
                "email": email,
                "token": raw_token,
                "expires_at": expires_at,
                "reset_type": "self"
            }, tenant_id=target_tenant)
            
            # Instantiate email service for the target tenant to get correct tenant portal_url
            email_svc = self.email_service if target_tenant == self.email_service.tenant_id else EmailService(tenant_id=target_tenant)
            
            # Send email — use target tenant's portal URL so the link points to {subdomain}.phygitron.com
            reset_link = f"{email_svc.portal_url}/reset-password?token={token}"
            
            # Get user name, fallback to email if not available
            user_name = user.get('name', email.split('@')[0])
            
            email_svc.send_password_reset_link(
                recipient_email=email,
                recipient_name=user_name,
                reset_link=reset_link,
                expires_hours=1
            )
            
            return {"success": True, "message": success_message}
        except Exception as e:
            # Log error but still return success to prevent email enumeration
            print(f"Error in request_password_reset: {str(e)}")
            return {"success": True, "message": success_message}
    
    def verify_reset_token(self, token: str) -> Dict[str, Any]:
        """Verify if reset token is valid"""
        if ":" not in token:
            tenant_id = "public"
            raw_token = token
        else:
            tenant_id, raw_token = token.split(":", 1)
            
        reset_token = self.repo.get_reset_token(raw_token, tenant_id=tenant_id)
        
        if not reset_token:
            return {"valid": False, "message": "Invalid or expired token"}
        
        if reset_token['used']:
            return {"valid": False, "message": "This reset link has already been used"}
        
        # Check expiration
        expires_at = reset_token['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.strptime(expires_at, '%Y-%m-%d %H:%M:%S.%f')
            
        if datetime.now() > expires_at:
            return {"valid": False, "message": "This reset link has expired"}

        raw_email = str(reset_token.get('email') or "").strip().lower()
        # Get user info
        user = self.repo.get_user_by_email(raw_email, tenant_id=tenant_id)
        if not user:
            return {"valid": False, "message": "User not found"}
        
        # Get user name, fallback to email if not available
        user_name = user.get('name', raw_email.split('@')[0])
        
        return {
            "valid": True,
            "email": raw_email,
            "name": user_name,
            "tenant_id": tenant_id,
            "raw_token": raw_token
        }
    
    def reset_password(self, token: str, new_password: str) -> Dict[str, Any]:
        """Reset password using token"""
        # Verify token
        verification = self.verify_reset_token(token)
        if not verification['valid']:
            return {"success": False, "message": verification['message']}
        
        email = str(verification['email']).strip().lower()
        tenant_id = verification['tenant_id']
        raw_token = verification['raw_token']
        
        # Hash new password
        password_hash = pbkdf2_sha256.hash(new_password)
        
        # Update password
        self.repo.update_password(email, password_hash, changed_by="Self", tenant_id=tenant_id)
        
        # Mark token as used
        self.repo.mark_token_used(raw_token, tenant_id=tenant_id)
        
        # Send notification email (non-blocking — password already committed)
        try:
            user = self.repo.get_user_by_email(email, tenant_id=tenant_id)
            user_name = user.get('name', email.split('@')[0]) if user else email.split('@')[0]
            self.email_service.send_password_changed_notification(
                recipient_email=email,
                recipient_name=user_name,
                changed_by="You"
            )
        except Exception as mail_err:
            print(f"[non-critical] Password changed notification failed: {mail_err}")
        
        return {"success": True, "message": "Password reset successfully"}
    
    def admin_reset_password(
        self, 
        employee_code: str, 
        reset_type: str,  # 'temp_password' or 'reset_link'
        admin_email: str,
        tenant_id: str = "public"
    ) -> Dict[str, Any]:
        """
        Admin/HR resets user password.
        reset_type: 'temp_password' or 'reset_link'
        """
        # Get employee info
        employee = self.repo.get_employee_by_code(employee_code, tenant_id=tenant_id)
        if not employee:
            return {"success": False, "message": "Employee not found"}
        
        email = str(employee.get('email_id') or "").strip().lower()
        if not email:
            return {"success": False, "message": "Employee has no email address"}
        
        if reset_type == 'temp_password':
            # Generate temporary password
            temp_password = self.generate_temp_password()
            password_hash = pbkdf2_sha256.hash(temp_password)
            
            # Update password and set must_change flag
            self.repo.update_password(
                email, 
                password_hash, 
                changed_by=admin_email,
                must_change=True,
                tenant_id=tenant_id,
                employee_code=employee_code
            )
            
            # Send email with temporary password
            email_result = self.email_service.send_temporary_password(
                recipient_email=email,
                recipient_name=employee['name'],
                temporary_password=temp_password,
                expires_hours=24
            )
            
            email_ok = bool(email_result.get('success'))
            msg = "Temporary password generated and emailed" if email_ok else f"Temporary password generated, but email delivery failed: {email_result.get('message', 'SMTP error')}"
            
            return {
                "success": True,
                "reset_type": "temp_password",
                "temp_password": temp_password,
                "temporary_password": temp_password,
                "email_sent": email_ok,
                "message": msg
            }
        
        elif reset_type == 'reset_link':
            # Generate reset token
            raw_token = str(uuid.uuid4())
            token = f"{tenant_id}:{raw_token}"
            expires_at = datetime.now() + timedelta(hours=1)
            
            # Invalidate existing tokens
            self.repo.invalidate_existing_tokens(email, tenant_id=tenant_id)
            
            # Create new token
            self.repo.create_reset_token({
                "email": email,
                "token": raw_token,
                "expires_at": expires_at,
                "reset_type": "admin",
                "created_by": admin_email
            }, tenant_id=tenant_id)
            
            # Send email — use tenant's portal URL
            reset_link = f"{self.email_service.portal_url}/reset-password?token={token}"
            
            email_result = self.email_service.send_password_reset_link(
                recipient_email=email,
                recipient_name=employee['name'],
                reset_link=reset_link,
                expires_hours=1
            )
            
            if not email_result.get('success'):
                return {
                    "success": False,
                    "reset_type": "reset_link",
                    "email_sent": False,
                    "message": f"Failed to send reset link to {email}: {email_result.get('message', 'SMTP error')}"
                }
            
            return {
                "success": True,
                "reset_type": "reset_link",
                "email_sent": True,
                "message": "Reset link sent to employee"
            }
        
        else:
            return {"success": False, "message": "Invalid reset type"}
    
    def check_must_change_password(self, email: str, tenant_id: str = "public") -> bool:
        """Check if user must change password on login"""
        email = str(email or "").strip().lower()
        user = self.repo.get_user_by_email(email, tenant_id=tenant_id)
        if not user:
            return False
        return bool(user.get('password_must_change', 0))
    
    def change_password_logged_in(
        self,
        email: str,
        current_password: str,
        new_password: str,
        tenant_id: str = 'public'
    ) -> Dict[str, Any]:
        """Change password for logged-in user"""
        email = str(email or "").strip().lower()
        user = self.repo.get_user_by_email(email, tenant_id)
        if not user:
            return {"success": False, "message": "User not found"}
        
        # Verify current password
        if not pbkdf2_sha256.verify(current_password, user['password_hash']):
            return {"success": False, "message": "Current password is incorrect"}
        
        # Hash new password
        password_hash = pbkdf2_sha256.hash(new_password)
        
        # Update password
        self.repo.update_password(email, password_hash, changed_by="Self", must_change=False, tenant_id=tenant_id)
        
        # Send notification (non-blocking — password already committed)
        try:
            user_name = user.get('name', email.split('@')[0])
            self.email_service.send_password_changed_notification(
                recipient_email=email,
                recipient_name=user_name,
                changed_by="You"
            )
        except Exception as mail_err:
            print(f"[non-critical] Password changed notification failed: {mail_err}")
        
        return {"success": True, "message": "Password changed successfully"}
