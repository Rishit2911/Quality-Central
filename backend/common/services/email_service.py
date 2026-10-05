import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / '.env'
    load_dotenv(env_path)
except ImportError:
    pass

try:
    from backend.common.services.email_template_builder import (
        build_white_label_html, build_white_label_text, build_cta_button_html,
        build_info_box_html, build_key_value_table_html
    )
except ImportError:
    try:
        from common.services.email_template_builder import (
            build_white_label_html, build_white_label_text, build_cta_button_html,
            build_info_box_html, build_key_value_table_html
        )
    except ImportError:
        from email_template_builder import (
            build_white_label_html, build_white_label_text, build_cta_button_html,
            build_info_box_html, build_key_value_table_html
        )


import logging
logger = logging.getLogger(__name__)

class EmailService:
    """
    Email service for onboarding invitations, security resets, and employee notifications.
    Uses configurable SMTP credentials and unified white-label styling.
    tenant_id is used to resolve the correct subdomain portal URL per tenant.
    """

    def __init__(self, tenant_id: str = None):
        self.smtp_server = os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER") or "smtp.gmail.com"
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER") or os.getenv("SENDER_EMAIL") or ""
        self.smtp_password = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD") or os.getenv("SENDER_PASSWORD") or ""
        self.sender_name = os.getenv("SENDER_NAME", "Phygitron 360")
        self.company_name = os.getenv("COMPANY_NAME", "Phygitron 360")
        self.tenant_id = tenant_id

        # Resolve tenant-specific subdomain and portal URL
        self._subdomain = None
        if tenant_id:
            try:
                from backend.core.database import get_db_connection
                conn = get_db_connection()
                with conn.cursor() as cur:
                    cur.execute("SELECT company_name, subdomain FROM public.tenants WHERE id = %s", (tenant_id,))
                    row = cur.fetchone()
                    if row:
                        self.company_name = row[0] or self.company_name
                        self._subdomain = row[1]
                conn.close()
            except Exception as e:
                logger.error("Failed to load tenant details for EmailService (tenant_id=%s): %s", tenant_id, e)

        # Build the portal URL — priority order:
        # 1. Subdomain from DB (tenant-specific, always correct)
        # 2. APP_BASE_URL env var (global fallback — used when no subdomain found)
        # 3. Hard fallback to app.phygitron.com
        # NOTE: APP_BASE_URL intentionally has LOWER priority than the DB subdomain
        # because APP_BASE_URL on production is set to phygitron.com (the root domain)
        # and would override tenant-specific subdomains if checked first.
        if self._subdomain:
            self.portal_url = f"https://{self._subdomain}.phygitron.com"
        else:
            env_base = os.getenv("APP_BASE_URL")
            self.portal_url = env_base.rstrip("/") if env_base else "https://app.phygitron.com"

        # Logo URL — prefer explicit LOGO_URL env var.
        # Fall back to main app domain + /api/static/logo.png so it's always publicly reachable.
        # DO App Platform routes /api to the backend.
        fallback_logo = f"{os.getenv('APP_BASE_URL', 'https://phygitron.com').rstrip('/')}/api/static/logo.png"
        self.platform_logo_url = os.getenv("LOGO_URL") or fallback_logo

    def _send(self, message: MIMEMultipart) -> dict:
        """Helper to send a preconfigured MIMEMultipart over SMTP."""
        if not self.smtp_user or not self.smtp_password:
            return {"success": False, "message": "Email not configured. Please set SMTP_USER and SMTP_PASS."}
        try:
            if message.get("To"):
                message.replace_header("To", str(message["To"]).strip().lower())
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
            return {"success": True, "message": f"Email sent successfully to {message['To']}"}
        except smtplib.SMTPAuthenticationError:
            return {"success": False, "message": "Email authentication failed. Check SMTP credentials."}
        except Exception as e:
            return {"success": False, "message": f"Failed to send email: {str(e)}"}

    def send_onboarding_invitation(
        self, 
        recipient_email: str, 
        recipient_name: str, 
        onboarding_link: str,
        expires_days: int = 7
    ) -> dict:
        """1. Onboarding Invitation (Template Library #1)"""
        recipient_email = str(recipient_email or "").strip().lower()
        subject = "Get Started: Complete Your Profile on Phygitron - Employee Central"

        body_html = f"""
        <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{recipient_name}</strong>,</p>
        <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">Welcome aboard! We are excited to welcome you to <strong>Phygitron 360 Employee Central</strong>.</p>
        <p style="font-size: 15px; color: #334155; margin: 0 0 24px 0;">Please access the secure employee onboarding portal to submit your accurate personal records and upload necessary employment documents (Photo, ID Proof, CV):</p>
        """
        body_html += build_cta_button_html(onboarding_link, "Complete onboarding &rarr;")
        body_html += build_info_box_html(f"<strong>Note:</strong> This unique onboarding link expires in <strong>{expires_days} days</strong>. Please complete all steps before the deadline.")
        
        html_content = build_white_label_html(
            title="Complete Your Onboarding",
            headline="Welcome to your new workspace!",
            body_html=body_html,
            company_name=f"{self.company_name} HR & People Team",
            fallback_url=onboarding_link,
            logo_url=self.platform_logo_url
        )
        
        body_text = f"Hello {recipient_name},\n\nWelcome aboard! We are excited to welcome you to Phygitron 360 Employee Central.\n\nPlease complete your onboarding form and document uploads using the link below before it expires in {expires_days} days."
        text_content = build_white_label_text("Complete Your Onboarding", "Welcome to your new workspace!", body_text, f"{self.company_name} HR & People Team", onboarding_link)
        
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.sender_name} <{self.smtp_user}>"
        message["To"] = recipient_email
        message.attach(MIMEText(text_content, "plain"))
        message.attach(MIMEText(html_content, "html"))
        return self._send(message)

    def send_password_reset_link(
        self,
        recipient_email: str,
        recipient_name: str,
        reset_link: str,
        expires_hours: int = 1
    ) -> dict:
        """2 & 12. Forgot Password / Admin Password Reset Link"""
        recipient_email = str(recipient_email or "").strip().lower()
        subject = "Reset Your Password — Phygitron 360"

        body_html = f"""
        <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{recipient_name}</strong>,</p>
        <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">We received a request to reset the account password for your <strong>Phygitron 360</strong> workspace. To set a new password, click below:</p>
        """
        body_html += build_cta_button_html(reset_link, "Reset Password &rarr;")
        body_html += build_info_box_html(f"<strong>Security Warning:</strong> This link expires in <strong>{expires_hours} hour(s)</strong>.<br>If you did not initiate this request, please safely ignore this email or contact HR immediately.", border_color="#EAB308")
        
        html_content = build_white_label_html(
            title="Reset Your Password",
            headline="Password Reset Request",
            body_html=body_html,
            company_name=f"{self.company_name} Support & Security Team",
            fallback_url=reset_link,
            logo_url=self.platform_logo_url
        )
        
        body_text = f"Hello {recipient_name},\n\nWe received a request to reset your account password. Use the secure link below to set a new password within {expires_hours} hour(s).\n\nIf you did not request this change, ignore this email."
        text_content = build_white_label_text("Reset Your Password", "Password Reset Request", body_text, f"{self.company_name} Support & Security Team", reset_link)

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.sender_name} <{self.smtp_user}>"
        message["To"] = recipient_email
        message.attach(MIMEText(text_content, "plain"))
        message.attach(MIMEText(html_content, "html"))
        return self._send(message)

    def send_temporary_password(
        self,
        recipient_email: str,
        recipient_name: str,
        temporary_password: str,
        expires_hours: int = 24
    ) -> dict:
        """11. Temporary Password Sent by Admin"""
        recipient_email = str(recipient_email or "").strip().lower()
        subject = "Temporary Login Credentials — Phygitron 360"
        login_url = self.portal_url

        body_html = f"""
        <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{recipient_name}</strong>,</p>
        <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">An system administrator has generated temporary login credentials for your <strong>Phygitron 360</strong> employee account.</p>
        """
        body_html += build_key_value_table_html([
            ("Username / Email", recipient_email),
            ("Temporary Password", f"<code style='color: #7000FF; font-weight: bold; font-size: 16px; background: #F1F5F9; padding: 4px 8px; border-radius: 4px;'>{temporary_password}</code>")
        ])
        body_html += build_cta_button_html(login_url, "Login to Portal &rarr;")
        body_html += build_info_box_html(f"<strong>Action Required:</strong> For security reasons, please log in and change this temporary password immediately upon first access. This credential expires in <strong>{expires_hours} hours</strong>.", border_color="#EAB308")
        
        html_content = build_white_label_html(
            title="Temporary Login Credentials",
            headline="Your account credentials have been reset",
            body_html=body_html,
            company_name=f"{self.company_name} System Administration Team",
            fallback_url=login_url,
            logo_url=self.platform_logo_url
        )
        
        body_text = f"Hello {recipient_name},\n\nAn administrator has generated temporary login credentials for your account.\n\nUsername: {recipient_email}\nTemporary Password: {temporary_password}\n\nPlease log in and update your password immediately."
        text_content = build_white_label_text("Temporary Credentials", "Your account credentials have been reset", body_text, f"{self.company_name} System Administration Team", login_url)

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.sender_name} <{self.smtp_user}>"
        message["To"] = recipient_email
        message.attach(MIMEText(text_content, "plain"))
        message.attach(MIMEText(html_content, "html"))
        return self._send(message)

    def send_password_changed_notification(
        self,
        recipient_email: str,
        recipient_name: str,
        changed_by: str = "You"
    ) -> dict:
        """10. Password Changed Confirmation / Profile Password Updated"""
        recipient_email = str(recipient_email or "").strip().lower()
        subject = "Password Successfully Changed — Phygitron 360"

        body_html = f"""
        <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{recipient_name}</strong>,</p>
        <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">This is an automated confirmation that your <strong>Phygitron 360</strong> account password was successfully updated through your security settings.</p>
        """
        body_html += build_info_box_html(f"<strong>Update Details:</strong><br>&bull; Modified by: {changed_by}<br>&bull; Timestamp: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}<br><br>No further action is required if you authorized this change.", border_color="#10B981")
        body_html += f"""
        <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;"><strong>Did not make this change?</strong><br>If you did not initiate this change, your account credentials may be compromised. Please contact your HR Operations team immediately.</p>
        """
        
        html_content = build_white_label_html(
            title="Password Successfully Changed",
            headline="Your password has been updated",
            body_html=body_html,
            company_name=f"{self.company_name} Support Team",
            logo_url=self.platform_logo_url
        )
        
        body_text = f"Hello {recipient_name},\n\nThis is a confirmation that your account password was successfully changed by: {changed_by}.\n\nIf you did not make this change, please contact your HR Team immediately."
        text_content = build_white_label_text("Password Changed", "Your password has been updated", body_text, f"{self.company_name} Support Team")

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.sender_name} <{self.smtp_user}>"
        message["To"] = recipient_email
        message.attach(MIMEText(text_content, "plain"))
        message.attach(MIMEText(html_content, "html"))
        return self._send(message)

    def send_new_employee_credentials(
        self,
        recipient_email: str,
        recipient_name: str,
        employee_code: str,
        temporary_password: str,
        login_url: str = ""
    ) -> dict:
        """8. Employee Welcome Email (Direct HR login account provisioning)"""
        recipient_email = str(recipient_email or "").strip().lower()
        if not login_url:
            login_url = self.portal_url
        subject = "Welcome to Phygitron 360 — Your Account is Ready"

        body_html = f"""
        <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{recipient_name}</strong>,</p>
        <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">Welcome to the team! Your employee account for <strong>Phygitron 360</strong> has been created and activated in our workforce management portal.</p>
        """
        body_html += build_key_value_table_html([
            ("Employee Code", employee_code),
            ("Username / Email", recipient_email),
            ("Temporary Password", f"<code style='color: #7000FF; font-weight: bold; font-size: 16px; background: #F1F5F9; padding: 4px 8px; border-radius: 4px;'>{temporary_password}</code>")
        ])
        body_html += build_cta_button_html(login_url, "Access Employee Portal &rarr;")
        body_html += build_info_box_html("<strong>Security Policy:</strong> Please log in using your assigned username and temporary password above, and change your password upon first access. We wish you a successful journey with us!")

        html_content = build_white_label_html(
            title="Welcome to the Team",
            headline="Your employee account is ready!",
            body_html=body_html,
            company_name=f"{self.company_name} HR & Operations Team",
            fallback_url=login_url,
            logo_url=self.platform_logo_url
        )

        body_text = f"Hello {recipient_name},\n\nWelcome to the team! Your account has been created.\n\nEmployee Code: {employee_code}\nUsername: {recipient_email}\nTemporary Password: {temporary_password}\n\nPlease change your password upon first login at: {login_url}"
        text_content = build_white_label_text("Welcome to the Team", "Your employee account is ready!", body_text, f"{self.company_name} HR & Operations Team", login_url)

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{self.sender_name} <{self.smtp_user}>"
        message["To"] = recipient_email
        message.attach(MIMEText(text_content, "plain"))
        message.attach(MIMEText(html_content, "html"))
        return self._send(message)

    def is_configured(self) -> bool:
        """Check if email service is properly configured"""
        return bool(self.smtp_user and self.smtp_password)
