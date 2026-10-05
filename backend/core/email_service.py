import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging

logger = logging.getLogger(__name__)

try:
    from common.services.email_template_builder import (
        build_white_label_html, build_white_label_text, build_cta_button_html,
        build_info_box_html, build_key_value_table_html
    )
except ImportError:
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from common.services.email_template_builder import (
        build_white_label_html, build_white_label_text, build_cta_button_html,
        build_info_box_html, build_key_value_table_html
    )


def send_welcome_email(to_email: str, company_name: str, temp_password: str, subdomain: str, admin_name: str = "Administrator") -> bool:
    """
    Sends the Org Admin Workspace Welcome email with login credentials and portal URL.
    Falls back to structured mock logging if SMTP credentials are not configured.
    """
    to_email = str(to_email or "").strip().lower()
    workspace_url = f"https://{subdomain}.phygitron.com" if subdomain else os.getenv("APP_BASE_URL", "https://app.phygitron.com")
    subject = f"Welcome to Phygitron 360 — Your Workspace is Ready"
    
    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{admin_name}</strong>,</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">Welcome to <strong>Phygitron 360 Employee Central</strong>. Your organization workspace for <strong>{company_name}</strong> has been successfully provisioned and is ready for operational use.</p>
    """
    body_html += build_key_value_table_html([
        ("Workspace URL", f"<a href='{workspace_url}' style='color: #7000FF; text-decoration: none; font-weight: 600;'>{workspace_url}</a>"),
        ("Admin Login Email", to_email),
        ("Temporary Password", f"<code style='color: #7000FF; font-weight: bold; font-size: 16px; background: #F1F5F9; padding: 4px 8px; border-radius: 4px;'>{temp_password}</code>")
    ])
    body_html += build_cta_button_html(workspace_url, "Access Admin Workspace &rarr;")
    body_html += build_info_box_html("<strong>Security Notice:</strong> For enterprise compliance and security reasons, please log in and change your administrator password immediately upon first access. We look forward to supporting your workforce management journey.")
    
    html_content = build_white_label_html(
        title="Workspace Provisioned",
        headline="Your Organization Workspace is Ready!",
        body_html=body_html,
        company_name="Phygitron 360 Platform Team",
        fallback_url=workspace_url
    )
    
    body_text = f"Hello {admin_name},\n\nWelcome to Phygitron 360 Employee Central. Your workspace for '{company_name}' is ready.\n\nWorkspace URL: {workspace_url}\nAdmin Email: {to_email}\nTemporary Password: {temp_password}\n\nPlease log in and update your security credentials immediately."
    text_content = build_white_label_text("Workspace Provisioned", "Your Organization Workspace is Ready!", body_text, "Phygitron 360 Platform Team", workspace_url)
    
    smtp_host = os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD")
    
    if not all([smtp_host, smtp_user, smtp_pass]):
        logger.warning(f"[EMAIL MOCK] Missing SMTP configuration. Dispatching welcome email to logs only.")
        print(f"\n--- 📧 MOCK EMAIL DISPATCH [Org Admin Welcome] ---")
        print(f"To:      {to_email}")
        print(f"Subject: {subject}")
        print(f"Body:\n{text_content}")
        print(f"----------------------------------------------------\n")
        return True
        
    try:
        msg = MIMEMultipart("alternative")
        msg['From'] = f"Phygitron 360 <{smtp_user}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            
        logger.info(f"Welcome email successfully sent to Org Admin {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send welcome email to {to_email}: {e}")
        return False
