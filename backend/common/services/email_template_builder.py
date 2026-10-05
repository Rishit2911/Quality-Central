"""
Phygitron 360 — White-Label Email Template Builder
=====================================================
Centralized HTML & Plain Text template generator for all system transactional emails.

Design Standards:
- Left-aligned, pure white card (#FFFFFF) on subtle gray background (#F8FAFC)
- Phygitron purple accent top border (#7000FF)
- Absolute HTTPS URLs for logos and static assets (zero MIME attachments / Gmail badges)
- Full white-labeling: dynamic {{ company_name }} replacement with zero hardcoded vendor lock-in
- Modular HTML elements: CTA buttons, key-value detail tables, callout notes
"""

import os

def get_default_logo_url() -> str:
    """
    Returns a publicly reachable HTTPS logo URL for emails.
    - Uses LOGO_URL env var if explicitly configured.
    - Builds https://{domain}/api/static/logo.png from APP_BASE_URL or BACKEND_URL.
    - If base URL is localhost/http (dev mode), defaults to https://phygitron.com/api/static/logo.png
      so email clients (e.g. Gmail) can load the logo over public HTTPS without broken image placeholders.
    """
    custom_logo = os.getenv("LOGO_URL")
    if custom_logo:
        return custom_logo
    base_url = (os.getenv("APP_BASE_URL") or os.getenv("BACKEND_URL") or "https://phygitron.com").rstrip("/")
    if "localhost" in base_url or base_url.startswith("http://"):
        return "https://phygitron.com/api/static/logo.png"
    return f"{base_url}/api/static/logo.png"


def get_tenant_portal_url(subdomain: str = None, path: str = "") -> str:
    """
    Builds the correct tenant-aware portal URL.
    - If APP_BASE_URL is set in env, uses that (for local dev / custom setups).
    - If a subdomain is provided, builds  https://{subdomain}.phygitron.com{path}
    - Falls back to https://app.phygitron.com{path}
    """
    env_url = os.getenv("APP_BASE_URL")
    if env_url:
        return f"{env_url.rstrip('/')}{path}"
    if subdomain:
        return f"https://{subdomain}.phygitron.com{path}"
    return f"https://app.phygitron.com{path}"


def build_cta_button_html(url: str, label: str) -> str:
    """Returns a resilient, table-based button for email clients."""
    return f"""
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0 28px 0;">
        <tr>
            <td style="background-color: #7000FF; border-radius: 6px;">
                <a href="{url}" style="display: inline-block; background-color: #7000FF; color: #FFFFFF; padding: 12px 26px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">{label}</a>
            </td>
        </tr>
    </table>
    """


def build_info_box_html(text_html: str, border_color: str = "#94A3B8", bg_color: str = "#F8FAFC", text_color: str = "#64748B") -> str:
    """Returns a clean callout box for notes, expiry warnings, or reminders."""
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0 28px 0;">
        <tr>
            <td style="background-color: {bg_color}; border-left: 3px solid {border_color}; border-radius: 4px; padding: 12px 16px; font-size: 13.5px; color: {text_color}; line-height: 1.5;">
                {text_html}
            </td>
        </tr>
    </table>
    """


def build_key_value_table_html(items: list) -> str:
    """Returns a neatly styled key-value summary table (e.g. credentials, assignment dates)."""
    rows_html = ""
    for label, val in items:
        rows_html += f"""
        <tr>
            <td style="padding: 8px 16px 8px 0; font-size: 14px; font-weight: 600; color: #475569; vertical-align: top; border-bottom: 1px solid #F1F5F9; width: 140px;">{label}</td>
            <td style="padding: 8px 0 8px 0; font-size: 14px; color: #0F172A; vertical-align: top; border-bottom: 1px solid #F1F5F9; font-family: 'Segoe UI', Roboto, Arial, sans-serif;">{val}</td>
        </tr>
        """
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 16px 0 24px 0; border-top: 1px solid #F1F5F9;">
        {rows_html}
    </table>
    """


def build_white_label_html(
    title: str,
    headline: str,
    body_html: str,
    company_name: str,
    fallback_url: str = None,
    logo_url: str = None
) -> str:
    """
    Wraps email content in the unified white-label design template.
    """
    logo = logo_url or get_default_logo_url()
    
    fallback_section = ""
    if fallback_url:
        fallback_section = f"""
        <p style="font-size: 12px; color: #64748B; margin: 0 0 8px 0;">If you're unable to click the button above, copy and paste this URL into your browser:</p>
        <p style="font-size: 12px; color: #7000FF; font-family: 'Courier New', Courier, monospace; background: #F1F5F9; padding: 8px 10px; border-radius: 4px; word-break: break-all; margin: 0 0 20px 0;">{fallback_url}</p>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #F8FAFC;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; width: 100%; background-color: #FFFFFF; border-top: 4px solid #7000FF; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; border-radius: 4px; text-align: left;">

                    <!-- LOGO HEADER (Real HTTPS Asset — zero attachments) -->
                    <tr>
                        <td style="padding: 36px 40px 24px 40px;">
                            <img src="{logo}" alt="Platform Logo" height="36" style="display: block; border: 0; height: 36px; width: auto;">
                        </td>
                    </tr>

                    <!-- THIN RULE BELOW LOGO -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr><td style="border-top: 1px solid #F1F5F9; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                            </table>
                        </td>
                    </tr>

                    <!-- MAIN BODY -->
                    <tr>
                        <td style="padding: 36px 40px 0 40px;">
                            <h1 style="font-size: 22px; font-weight: 700; color: #0F172A; margin: 0 0 20px 0; letter-spacing: -0.4px;">{headline}</h1>

                            {body_html}

                            <p style="font-size: 15px; color: #334155; margin: 28px 0 4px 0;">Regards,</p>
                            <p style="font-size: 15px; color: #0F172A; font-weight: 600; margin: 0 0 36px 0;">{company_name}</p>
                        </td>
                    </tr>

                    <!-- DIVIDER -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr><td style="border-top: 1px solid #E2E8F0; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                            </table>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="padding: 24px 40px 32px 40px;">
                            {fallback_section}
                            <p style="font-size: 12px; color: #94A3B8; margin: 0; line-height: 1.6;">
                                Powered by <strong style="color: #64748B;">Phygitron 360</strong> &nbsp;&bull;&nbsp; Enterprise Human Capital &amp; Operations Platform<br>
                                This automated notification was sent on behalf of {company_name}. Please do not reply to this message.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


def build_white_label_text(
    title: str,
    headline: str,
    body_text: str,
    company_name: str,
    fallback_url: str = None
) -> str:
    """
    Generates the matching plain text fallback message.
    """
    url_section = f"\nLink: {fallback_url}\n" if fallback_url else ""
    return f"""{headline}

{body_text}
{url_section}
Regards,
{company_name}

---
Powered by Phygitron 360 • Enterprise Human Capital & Operations Platform
This automated notification was sent on behalf of {company_name}. Please do not reply to this message.
"""
