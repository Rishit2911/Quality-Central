import pytest
from fastapi import HTTPException
from backend.core.permissions import P, require_permission
from backend.modules.deploy.services.password_service import PasswordService

def test_require_permission_admin_reset_password():
    checker = require_permission([P.DEPLOY_EMP_EDIT_BASIC, P.ADMIN_USERS_MANAGE])

    # Super admin bypass
    super_admin_user = {"roles": ["super_admin"], "permissions": {}}
    assert checker(super_admin_user) == super_admin_user

    # User with deploy.employees.edit_basic
    hr_user = {
        "roles": ["org_admin"],
        "permissions": {P.DEPLOY_EMP_EDIT_BASIC: True}
    }
    assert checker(hr_user) == hr_user

    # User with admin.users.manage
    admin_user = {
        "roles": ["admin"],
        "permissions": {P.ADMIN_USERS_MANAGE: True}
    }
    assert checker(admin_user) == admin_user

    # User with list permissions
    list_user = {
        "roles": ["org_admin"],
        "permissions": [P.DEPLOY_EMP_EDIT_BASIC]
    }
    assert checker(list_user) == list_user

    # User without permissions
    regular_user = {
        "roles": ["employee"],
        "permissions": {"deploy.employees.view_personal": True}
    }
    with pytest.raises(HTTPException) as exc_info:
        checker(regular_user)
    assert exc_info.value.status_code == 403
    assert "deploy.employees.edit_basic" in exc_info.value.detail or "admin.users.manage" in exc_info.value.detail

def test_password_service_generate_temp_password():
    svc = PasswordService()
    temp_pass = svc.generate_temp_password(length=12)
    assert len(temp_pass) == 12
    assert any(c.isupper() for c in temp_pass)
    assert any(c.isdigit() for c in temp_pass)
    assert any(c in "!@#$%" for c in temp_pass)

def test_email_service_normalizes_case(monkeypatch):
    from backend.common.services.email_service import EmailService
    svc = EmailService()
    sent_messages = []
    monkeypatch.setattr(svc, '_send', lambda msg: {"success": True, "message": f"Email sent successfully to {msg['To']}"})

    # Test onboarding email
    svc.send_onboarding_invitation("Bhupesh.Mangla@Something.COM", "Bhupesh", "http://example.com")
    
    # Test password reset email
    svc.send_password_reset_link("Bhupesh.Mangla@Something.COM", "Bhupesh", "http://example.com")
    
    # Test temp password email
    svc.send_temporary_password("Bhupesh.Mangla@Something.COM", "Bhupesh", "Temp1234!")
    
    # Test password changed notification
    svc.send_password_changed_notification("Bhupesh.Mangla@Something.COM", "Bhupesh")
    
    # Test new employee credentials email
    svc.send_new_employee_credentials("Bhupesh.Mangla@Something.COM", "Bhupesh", "EMP001", "Temp1234!")

def test_password_service_admin_reset_case_insensitive(monkeypatch):
    svc = PasswordService()
    
    # Mock employee returned with mixed case email
    monkeypatch.setattr(svc.repo, 'get_employee_by_code', lambda code, tenant_id='public': {
        "employee_code": "EMP001",
        "name": "Bhupesh Mangla",
        "email_id": "Bhupesh.Mangla@Something.COM"
    })
    
    updated_emails = []
    monkeypatch.setattr(svc.repo, 'update_password', lambda email, p_hash, changed_by, must_change=False, tenant_id='public', employee_code=None: updated_emails.append(email))
    
    sent_recipients = []
    monkeypatch.setattr(svc.email_service, 'send_temporary_password', lambda recipient_email, recipient_name, temporary_password, expires_hours=24: (sent_recipients.append(recipient_email), {"success": True})[1])
    
    # 1. Admin reset temp password
    res = svc.admin_reset_password("EMP001", "temp_password", "admin@phygitron.com")
    assert res['success'] is True
    assert updated_emails == ["bhupesh.mangla@something.com"]
    assert sent_recipients == ["bhupesh.mangla@something.com"]

    # 2. Admin reset link
    created_tokens = []
    monkeypatch.setattr(svc.repo, 'create_reset_token', lambda token_data, tenant_id='public': created_tokens.append(token_data))
    monkeypatch.setattr(svc.repo, 'invalidate_existing_tokens', lambda email, tenant_id='public': None)
    monkeypatch.setattr(svc.email_service, 'send_password_reset_link', lambda recipient_email, recipient_name, reset_link, expires_hours=1: (sent_recipients.append(recipient_email), {"success": True})[1])

    res_link = svc.admin_reset_password("EMP001", "reset_link", "admin@phygitron.com")
    assert res_link['success'] is True
    assert created_tokens[0]['email'] == "bhupesh.mangla@something.com"
    assert sent_recipients[-1] == "bhupesh.mangla@something.com"

def test_password_service_admin_reset_email_failure(monkeypatch):
    svc = PasswordService()
    monkeypatch.setattr(svc.repo, 'get_employee_by_code', lambda code, tenant_id='public': {
        "employee_code": "EMP001",
        "name": "Bhupesh Mangla",
        "email_id": "Bhupesh.Mangla@Something.COM"
    })
    monkeypatch.setattr(svc.repo, 'update_password', lambda *args, **kwargs: None)
    monkeypatch.setattr(svc.repo, 'create_reset_token', lambda *args, **kwargs: None)
    monkeypatch.setattr(svc.repo, 'invalidate_existing_tokens', lambda *args, **kwargs: None)
    
    # Mock email failure
    monkeypatch.setattr(svc.email_service, 'send_password_reset_link', lambda *args, **kwargs: {"success": False, "message": "SMTP Connection Refused"})
    
    res_link = svc.admin_reset_password("EMP001", "reset_link", "admin@phygitron.com")
    assert res_link['success'] is False
    assert res_link['email_sent'] is False
    assert "SMTP Connection Refused" in res_link['message']

def test_password_service_request_reset_case_insensitive(monkeypatch):
    svc = PasswordService()
    
    # Mock get_user_by_email
    monkeypatch.setattr(svc.repo, 'get_user_by_email', lambda email, tenant_id='public': {
        "username": "bhupesh.mangla@something.com",
        "name": "Bhupesh Mangla"
    })
    
    invalidated_emails = []
    monkeypatch.setattr(svc.repo, 'invalidate_existing_tokens', lambda email, tenant_id='public': invalidated_emails.append(email))
    
    created_tokens = []
    monkeypatch.setattr(svc.repo, 'create_reset_token', lambda token_data, tenant_id='public': created_tokens.append(token_data))
    
    sent_emails = []
    monkeypatch.setattr(svc.email_service, 'send_password_reset_link', lambda recipient_email, recipient_name, reset_link, expires_hours=1: (sent_emails.append(recipient_email), {"success": True})[1])
    
    res = svc.request_password_reset("Bhupesh.Mangla@Something.COM", tenant_id="public")
    assert res['success'] is True
    assert invalidated_emails == ["bhupesh.mangla@something.com"]
    assert created_tokens[0]['email'] == "bhupesh.mangla@something.com"
    assert sent_emails == ["bhupesh.mangla@something.com"]


