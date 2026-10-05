"""
Phygitron 360 — Extended HR & Operational Email Service
=========================================================
SMTP email suite for Talent Vault, Onboarding, Attendance, and Workforce exit management.
Supports automatic PDF attachment delivery and falls back to structured logging when offline.
All layouts adhere strictly to the Phygitron 360 White-Label Email Design standard.
"""

import smtplib
import logging
import os
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path)
    root_env_path = Path(__file__).parent.parent.parent / '.env'
    load_dotenv(root_env_path)
except ImportError:
    pass

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

# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _get_smtp_config():
    host = os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER") or "smtp.gmail.com"
    port = int(os.getenv("SMTP_PORT", 587))
    user = os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME") or os.getenv("SENDER_EMAIL") or os.getenv("SMTP_SENDER") or ""
    password = os.getenv("SMTP_PASS") or os.getenv("SMTP_PASSWORD") or os.getenv("SENDER_PASSWORD") or ""
    return host, port, user, password


def _send_via_smtp(msg: MIMEMultipart) -> bool:
    host, port, user, password = _get_smtp_config()
    if not user or not password:
        return False
    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.error(f"SMTP dispatch failed: {exc}")
        return False


SENT_MOCK_EMAILS = []

def _mock_log(to_email: str, subject: str, plain_body: str):
    logger.warning("[EMAIL MOCK] SMTP offline or unconfigured — logging email instead.")
    print(f"\n--- 📧 MOCK EMAIL DISPATCH [Extended Service] ---")
    print(f"To:      {to_email}")
    print(f"Subject: {subject}")
    print(f"Body:\n{plain_body}")
    print(f"---------------------------------------------------\n")
    SENT_MOCK_EMAILS.append({"to": to_email, "subject": subject, "body": plain_body})


# ---------------------------------------------------------------------------
# Talent Acquisition & Candidate Emails
# ---------------------------------------------------------------------------

def send_invite_email(
    to_email: str,
    candidate_name: str,
    role_name: str,
    company_name: str,
    temp_password: str,
    deadline: Optional[str] = None,
    portal_link: Optional[str] = None,
    custom_subject: Optional[str] = None,
    custom_body: Optional[str] = None,
) -> bool:
    """Candidate Invitation Email (Template Library #2)"""
    subject = custom_subject if custom_subject else f"Invitation to Apply — {role_name} at {company_name}"
    link = portal_link or os.getenv("APP_BASE_URL", "https://app.phygitron.com")
    deadline_line = deadline if deadline else "Please submit at your earliest convenience"

    if custom_body:
        body_html = f"<div style='font-size: 15px; color: #334155; margin-bottom: 24px;'>{custom_body.replace(chr(10), '<br/>')}</div>"
        body_text = custom_body
    else:
        body_html = f"""
        <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{candidate_name}</strong>,</p>
        <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">Thank you for your interest in career opportunities with <strong>{company_name}</strong>. You have been officially invited to submit your candidate application for the position of <strong>{role_name}</strong>.</p>
        """
        body_html += build_key_value_table_html([
            ("Role / Position", role_name),
            ("Application Deadline", deadline_line),
            ("Portal Username", to_email),
            ("Temporary Password", f"<code style='color: #7000FF; font-weight: bold; font-size: 16px; background: #F1F5F9; padding: 4px 8px; border-radius: 4px;'>{temp_password}</code>")
        ])
        body_html += build_cta_button_html(link, "Access Candidate Portal &rarr;")
        body_html += build_info_box_html("We look forward to reviewing your profile and credentials. Should you have any questions or require support during your application submission, please reach out to our Talent Acquisition Team.")
        
        body_text = f"Hello {candidate_name},\n\nYou have been invited to apply for the position of {role_name} at {company_name}.\n\nDeadline: {deadline_line}\nUsername: {to_email}\nTemporary Password: {temp_password}\n\nPortal Link: {link}\n\nWe look forward to reviewing your application."

    html_content = build_white_label_html("Invitation to Apply", f"You have been invited to apply for {role_name}!", body_html, f"{company_name} Talent Acquisition Team", link)
    text_content = build_white_label_text("Invitation to Apply", f"Invitation to apply for {role_name}", body_text, f"{company_name} Talent Acquisition Team", link)

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, text_content)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        if not _send_via_smtp(msg):
            _mock_log(to_email, subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_invite_email failed for {to_email}: {exc}")
        return False


def send_offer_letter_email(
    to_email: str,
    candidate_name: str,
    company_name: str,
    role_title: str,
    department: Optional[str] = "General",
    salary: Optional[str] = "As agreed",
    location: Optional[str] = "Headquarters / Remote",
    joining_date: Optional[str] = "To be advised",
    attachment_bytes: Optional[bytes] = None,
) -> bool:
    """Offer Letter Email (Template Library #5) with optional PDF attachment support"""
    subject = f"Offer Letter — {role_title} at {company_name}"

    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Dear <strong>{candidate_name}</strong>,</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">Congratulations! We are thrilled to extend an official offer of employment for the position of <strong>{role_title}</strong> at <strong>{company_name}</strong>.</p>
    """
    body_html += build_key_value_table_html([
        ("Position / Role", role_title),
        ("Department", department or "N/A"),
        ("Work Location", location or "N/A"),
        ("Expected Joining Date", joining_date or "To be confirmed"),
        ("Compensation", salary or "As discussed")
    ])
    body_html += build_info_box_html("<strong>Next Step:</strong> Please find your comprehensive formal Offer Letter attached to this email for your detailed review. We request you to review, sign, and return the document at your earliest convenience. We look forward to welcoming you to the team!", border_color="#10B981")

    html_content = build_white_label_html("Employment Offer", "Congratulations on your Offer!", body_html, f"{company_name} HR & Operations Team")
    body_text = f"Dear {candidate_name},\n\nCongratulations! We are pleased to extend an offer for the position of {role_title} at {company_name}.\n\nJoining Date: {joining_date}\nLocation: {location}\n\nPlease review the attached offer letter and respond at your earliest convenience."
    text_content = build_white_label_text("Employment Offer", "Congratulations on your Offer!", body_text, f"{company_name} HR & Operations Team")

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, text_content)
        return True

    try:
        msg = MIMEMultipart("mixed")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject

        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(text_content, "plain"))
        alt.attach(MIMEText(html_content, "html"))
        msg.attach(alt)

        if attachment_bytes:
            part = MIMEBase("application", "pdf")
            part.set_payload(attachment_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", 'attachment; filename="Offer_Letter.pdf"')
            msg.attach(part)

        if not _send_via_smtp(msg):
            _mock_log(to_email, subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_offer_letter_email failed: {exc}")
        return False


def send_assessment_notification_email(
    to_email: str,
    candidate_name: str,
    assessment_title: str,
    company_name: str = "Phygitron 360",
    deadline: Optional[str] = "Within 48 hours",
    duration_mins: Optional[int] = 60,
    question_count: Optional[int] = None,
    pass_score: Optional[float] = None,
    assessment_link: Optional[str] = None
) -> bool:
    """Universal Assessment Assigned Email for candidates and employees (Template Library #6)"""
    safe_company = (company_name or "").strip() or os.getenv("COMPANY_NAME") or "Phygitron 360"
    safe_title = (assessment_title or "Assessment").strip()
    subject = f"Assessment Invitation — {safe_title} | {safe_company}"
    
    env_base = os.getenv("APP_BASE_URL", "https://app.phygitron.com").rstrip("/")
    link = assessment_link or f"{env_base}/verify"

    # Clean display name
    clean_name = (candidate_name or "").strip()
    if clean_name:
        clean_name = clean_name.title()
    else:
        clean_name = to_email.split("@")[0].replace(".", " ").replace("_", " ").title() if to_email else "Team Member"

    # Format deadline
    deadline_str = deadline.strip() if deadline and str(deadline).strip() else "Within 48 hours"

    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{clean_name}</strong>,</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">You have been invited to complete an assessment on <strong>{safe_company} Assessment Central</strong>.</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 24px 0;">Please review the assessment parameters below and access your portal to get started:</p>
    """

    duration_label = f"{duration_mins} Minutes" if (duration_mins and int(duration_mins) > 0) else "Untimed"
    details = [
        ("Assessment", safe_title),
        ("Time Limit", duration_label),
    ]
    if question_count and int(question_count) > 0:
        details.append(("Total Questions", f"{question_count} Questions"))
    if pass_score is not None and float(pass_score) > 0:
        details.append(("Qualifying Score", f"{pass_score}%"))
    details.append(("Completion Deadline", deadline_str))

    body_html += build_key_value_table_html(details)
    body_html += build_cta_button_html(link, "Start Assessment &rarr;")
    body_html += build_info_box_html("<strong>Important Note:</strong> Please ensure you have a stable internet connection and an uninterrupted environment before commencing. We recommend starting well in advance of the deadline.", border_color="#7000FF")

    html_content = build_white_label_html(
        title="Assessment Assigned",
        headline="You Have Been Assigned an Assessment",
        body_html=body_html,
        company_name=f"{safe_company} Assessment Team",
        fallback_url=link
    )

    questions_line = f"\n- Total Questions: {question_count}" if question_count else ""
    pass_score_line = f"\n- Qualifying Score: {pass_score}%" if (pass_score is not None and float(pass_score) > 0) else ""
    body_text = f"""Hello {clean_name},

You have been invited to complete an assessment on {safe_company} Assessment Central.

Assessment Details:
- Assessment: {safe_title}
- Time Limit: {duration_label}{questions_line}{pass_score_line}
- Completion Deadline: {deadline_str}

Please access your portal to get started: {link}

We recommend starting well in advance of the deadline in an uninterrupted environment.

We wish you the very best!"""

    text_content = build_white_label_text(
        title="Assessment Assigned",
        headline="You Have Been Assigned an Assessment",
        body_text=body_text,
        company_name=f"{safe_company} Assessment Team",
        fallback_url=link
    )

    host, port, user, password = _get_smtp_config()
    if not user or not password:
        _mock_log(to_email, subject, text_content)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{safe_company} Assessment Central <{user}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        if not _send_via_smtp(msg):
            _mock_log(to_email, subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_assessment_notification failed: {exc}")
        return False


# ---------------------------------------------------------------------------
# Employee & Internal Opportunities
# ---------------------------------------------------------------------------

def send_internal_opportunity_email(
    to_email: str,
    employee_name: str,
    job_title: str,
    department: str,
    application_deadline: str,
    company_name: str = "Phygitron 360",
    portal_link: Optional[str] = None
) -> bool:
    """[NEW] Internal Employee Application Invitation (Template Library #3)"""
    subject = f"Internal Opportunity — {job_title} ({department})"
    link = portal_link or os.getenv("APP_BASE_URL", "https://app.phygitron.com/internal-jobs")

    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{employee_name}</strong>,</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">As part of our commitment to professional growth and internal career advancement at <strong>{company_name}</strong>, we are pleased to announce an exciting internal mobility opportunity:</p>
    """
    body_html += build_key_value_table_html([
        ("Position / Role", job_title),
        ("Department", department),
        ("Application Deadline", application_deadline)
    ])
    body_html += build_cta_button_html(link, "View Internal Opening &rarr;")
    body_html += build_info_box_html("If your qualifications match this profile and you are ready for your next career challenge, we invite you to securely submit your internal expression of interest via the Employee Central Portal. Best of luck!")

    html_content = build_white_label_html("Internal Opportunity", f"New Internal Role: {job_title}", body_html, f"{company_name} HR Team", link)
    body_text = f"Hello {employee_name},\n\nAn exciting internal opportunity is available within the organization.\nPosition: {job_title}\nDepartment: {department}\nDeadline: {application_deadline}\n\nApply via your portal: {link}"
    text_content = build_white_label_text("Internal Opportunity", f"New Internal Role: {job_title}", body_text, f"{company_name} HR Team", link)

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, text_content)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        if not _send_via_smtp(msg):
            _mock_log(to_email, subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_internal_opportunity_email failed: {exc}")
        return False


def send_generic_notification_email(
    to_email: str,
    candidate_name: str,
    notification_subject: str,
    notification_message: str,
    company_name: str = "Phygitron 360",
    action_url: Optional[str] = None,
    action_label: str = "View Dashboard &rarr;"
) -> bool:
    """Generic HR Notification (Template Library #4 — e.g., Course assignment, updates)"""
    link = action_url or os.getenv("APP_BASE_URL", "https://app.phygitron.com/dashboard")
    
    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{candidate_name}</strong>,</p>
    <div style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        {notification_message.replace(chr(10), '<br/>')}
    </div>
    """
    body_html += build_cta_button_html(link, action_label)
    body_html += build_info_box_html("Please log in to your employee or learning portal using your credentials to review additional details and complete any assigned objectives.")

    html_content = build_white_label_html("HR Notification", notification_subject, body_html, f"{company_name} HR Operations Team", link)
    body_text = f"Hello {candidate_name},\n\n{notification_message}\n\nAccess your portal here: {link}"
    text_content = build_white_label_text("HR Notification", notification_subject, body_text, f"{company_name} HR Operations Team", link)

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, notification_subject, text_content)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = notification_subject
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        if not _send_via_smtp(msg):
            _mock_log(to_email, notification_subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_generic_notification failed: {exc}")
        return False


# ---------------------------------------------------------------------------
# Attendance, Time & Corrections
# ---------------------------------------------------------------------------

def send_clockout_reminder_email(
    to_email: str,
    employee_name: str,
    clockin_time: str,
    date: str,
    company_name: str = "Phygitron 360"
) -> bool:
    """Forgot to Clock Out Reminder (Template Library #13)"""
    subject = f"Attendance Reminder — Action Required for {date}"
    link = os.getenv("APP_BASE_URL", "https://app.phygitron.com/attendance")

    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{employee_name}</strong>,</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">Our automated attendance records indicate that you clocked in on <strong>{date}</strong> at <strong>{clockin_time}</strong>, but we have not recorded a valid clock-out punch for the shift.</p>
    """
    body_html += build_key_value_table_html([
        ("Shift Date", date),
        ("Recorded Clock-In", clockin_time),
        ("Clock-Out Status", "<span style='color: #EF4444; font-weight: 600;'>Missing Punch / Pending</span>")
    ])
    body_html += build_cta_button_html(link, "Update Attendance &rarr;")
    body_html += build_info_box_html("Please log in to your employee Self-Service Portal as soon as possible to review your timesheets and submit a corresponding attendance correction request if required.", border_color="#F97316")

    html_content = build_white_label_html("Attendance Reminder", "Missing Clock-Out Record", body_html, f"{company_name} HR Operations Team", link)
    body_text = f"Hello {employee_name},\n\nOur records indicate that you may have forgotten to clock out on {date} (Clock-in: {clockin_time}).\n\nPlease review and update your attendance record at: {link}"
    text_content = build_white_label_text("Attendance Reminder", "Missing Clock-Out Record", body_text, f"{company_name} HR Operations Team", link)

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, text_content)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        if not _send_via_smtp(msg):
            _mock_log(to_email, subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_clockout_reminder failed: {exc}")
        return False


def send_attendance_correction_request_email(
    to_email: str,
    manager_name: str,
    employee_name: str,
    date: str,
    reason: str,
    company_name: str = "Phygitron 360",
    portal_link: Optional[str] = None
) -> bool:
    """[NEW] Attendance Correction Approval Request (Template Library #14)"""
    subject = f"Attendance Correction Approval Required — {employee_name}"
    link = portal_link or os.getenv("APP_BASE_URL", "https://app.phygitron.com/approvals")

    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{manager_name}</strong>,</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">A formal attendance correction and punch override request has been submitted by your team member, <strong>{employee_name}</strong>, requiring your managerial review.</p>
    """
    body_html += build_key_value_table_html([
        ("Employee Name", employee_name),
        ("Date of Record", date),
        ("Submitted Reason", f"<em style='color: #475569;'>{reason}</em>"),
        ("Approval Status", "<span style='color: #EAB308; font-weight: 600;'>Pending Manager Approval</span>")
    ])
    body_html += build_cta_button_html(link, "Review Request in Portal &rarr;")
    body_html += build_info_box_html("Please log in to your Manager Self-Service dashboard to verify shift timing logs and authorize or decline this correction request at your earliest convenience.")

    html_content = build_white_label_html("Approval Required", "Attendance Correction Request", body_html, f"{company_name} HR Operations", link)
    body_text = f"Hello {manager_name},\n\nAn attendance correction request has been submitted by {employee_name}.\nDate: {date}\nReason: {reason}\n\nPlease review and approve/reject the request at: {link}"
    text_content = build_white_label_text("Approval Required", "Attendance Correction Request", body_text, f"{company_name} HR Operations", link)

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, text_content)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        if not _send_via_smtp(msg):
            _mock_log(to_email, subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_attendance_correction_request failed: {exc}")
        return False


def send_bimonthly_report_email(
    to_email: str,
    manager_name: str,
    report_data: list,
    period_label: str,
    company_name: str = "Phygitron 360"
) -> bool:
    """Attendance Report Email (Template Library #15) with generated ReportLab PDF table"""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    import io

    subject = f"Attendance Report — {period_label} ({company_name})"
    link = os.getenv("APP_BASE_URL", "https://app.phygitron.com/reports")

    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Hello <strong>{manager_name}</strong>,</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">Please find attached the formal workforce attendance and exception summary report for your organizational department covering the period <strong>{period_label}</strong>.</p>
    """
    body_html += build_key_value_table_html([
        ("Reporting Period", period_label),
        ("Total Records", str(len(report_data))),
        ("Attachment Format", "PDF Document (.pdf)")
    ])
    body_html += build_cta_button_html(link, "Access Analytics Dashboard &rarr;")
    body_html += build_info_box_html("The accompanying PDF report details present shift hours, unexcused absences, half-days, and leaves. Please review exceptions requiring managerial attention.", border_color="#3B82F6")

    html_content = build_white_label_html("Attendance Report", f"Team Attendance Report: {period_label}", body_html, f"{company_name} HR Operations", link)
    body_text = f"Hello {manager_name},\n\nPlease find attached the attendance report for your team for the period {period_label}.\n\nThe attached report contains attendance summaries and exceptions requiring attention."
    text_content = build_white_label_text("Attendance Report", f"Team Attendance Report: {period_label}", body_text, f"{company_name} HR Operations", link)

    # Compile ReportLab PDF
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph(f"Attendance Report: {period_label}", styles['Title']),
        Spacer(1, 12)
    ]
    
    data = [["Employee Name", "Code", "Present", "Absent", "Half-Day", "Leave"]]
    for emp in report_data:
        stats = emp.get("stats", {})
        data.append([
            emp.get("name", ""), emp.get("code", ""),
            str(stats.get("present", 0)), str(stats.get("absent", 0)),
            str(stats.get("half_day", 0)), str(stats.get("leave", 0))
        ])
        
    t = Table(data)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#7000FF")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1"))
    ]))
    elements.append(t)
    doc.build(elements)
    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, text_content)
        return True

    try:
        msg = MIMEMultipart("mixed")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject

        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(text_content, "plain"))
        alt.attach(MIMEText(html_content, "html"))
        msg.attach(alt)

        part = MIMEBase("application", "pdf")
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="Attendance_Report_{period_label.replace(" ", "_")}.pdf"')
        msg.attach(part)

        if not _send_via_smtp(msg):
            _mock_log(to_email, subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_bimonthly_report failed: {exc}")
        return False


# ---------------------------------------------------------------------------
# Exit Management & Offboarding
# ---------------------------------------------------------------------------

def send_relieving_letter_email(
    to_email: str,
    employee_name: str,
    company_name: str = "Phygitron 360",
    last_working_day: Optional[str] = "Recorded date",
    designation: Optional[str] = "Team Member",
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: str = "Relieving_Letter_and_Exit_Documents.pdf"
) -> bool:
    """[NEW] Relieving Letter & Exit Documents Email (Template Library #16) with PDF attachment"""
    subject = f"Relieving Letter and Exit Documents — {company_name}"
    portal_link = os.getenv("APP_BASE_URL", "https://app.phygitron.com")

    body_html = f"""
    <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">Dear <strong>{employee_name}</strong>,</p>
    <p style="font-size: 15px; color: #334155; margin: 0 0 20px 0;">Thank you sincerely for your dedicated contributions during your employment tenure with <strong>{company_name}</strong>.</p>
    """
    body_html += build_key_value_table_html([
        ("Employee Name", employee_name),
        ("Last Designation", designation),
        ("Last Working Day", last_working_day),
        ("Enclosed Documents", "Formal Relieving Letter & Exit Pack")
    ])
    body_html += build_info_box_html("<strong>Enclosures Attached:</strong> Please find attached your official Relieving Letter and associated clearance exit documents for your professional archives.<br><br>We wish you continued growth, fulfillment, and success in all your future endeavors!", border_color="#7000FF")
    body_html += f"""
    <p style="font-size: 15px; color: #334155; margin: 20px 0 0 0;">Should you have any subsequent inquiries or require additional support regarding your post-employment benefits, tax certificates, or exit formalities, please feel free to reach out directly to the HR Operations team.</p>
    """

    html_content = build_white_label_html("Exit Formalities & Relieving Letter", "Thank you for your contributions", body_html, f"{company_name} HR & People Team")
    body_text = f"Dear {employee_name},\n\nThank you for your contributions to {company_name}.\n\nPlease find attached your relieving letter and associated exit documents for your records. We wish you continued success in your future endeavors.\n\nShould you have any questions regarding your exit formalities, please feel free to reach out to the HR team."
    text_content = build_white_label_text("Exit Formalities & Relieving Letter", "Thank you for your contributions", body_text, f"{company_name} HR & People Team")

    host, _, user, _ = _get_smtp_config()
    if not all([host, user]):
        _mock_log(to_email, subject, text_content)
        return True

    try:
        msg = MIMEMultipart("mixed")
        msg["From"] = user
        msg["To"] = to_email
        msg["Subject"] = subject

        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(text_content, "plain"))
        alt.attach(MIMEText(html_content, "html"))
        msg.attach(alt)

        if attachment_bytes:
            part = MIMEBase("application", "pdf")
            part.set_payload(attachment_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{attachment_filename}"')
            msg.attach(part)

        if not _send_via_smtp(msg):
            _mock_log(to_email, subject, text_content)
        return True
    except Exception as exc:
        logger.error(f"send_relieving_letter_email failed: {exc}")
        return False
