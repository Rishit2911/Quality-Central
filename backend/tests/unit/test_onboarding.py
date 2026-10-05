import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.modules.deploy.services.onboarding_service import OnboardingService

client = TestClient(app)

def test_verify_token_public_success():
    """Verify that verify-token endpoint is accessible without authentication."""
    mock_invite = {
        "email": "candidate@example.com",
        "name": "Jane Doe",
        "first_name": "Jane",
        "middle_name": "",
        "last_name": "Doe",
        "role": "employee",
        "department": "Engineering",
        "designation": "Software Engineer",
        "expires_at": datetime.now() + timedelta(days=5),
        "tenant_id": "tenant_test"
    }

    with patch.object(OnboardingService, 'verify_token', return_value={
        "valid": True,
        "email": mock_invite["email"],
        "name": mock_invite["name"],
        "first_name": mock_invite["first_name"],
        "middle_name": mock_invite["middle_name"],
        "last_name": mock_invite["last_name"],
        "role": mock_invite["role"],
        "department": mock_invite["department"],
        "designation": mock_invite["designation"]
    }):
        response = client.post("/api/onboarding/verify-token", json={"token": "valid-token-123"})
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["email"] == "candidate@example.com"
        assert data["name"] == "Jane Doe"

def test_verify_token_public_invalid():
    """Verify that invalid token returns 400 without auth required."""
    with patch.object(OnboardingService, 'verify_token', side_effect=ValueError("Invalid or expired token")):
        response = client.post("/api/onboarding/verify-token", json={"token": "invalid-token-xyz"})
        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid or expired token"

def test_verify_token_missing_token():
    """Verify that missing token returns 400."""
    response = client.post("/api/onboarding/verify-token", json={})
    assert response.status_code == 400
    assert response.json()["detail"] == "Token required"

def test_complete_onboarding_public():
    """Verify that onboarding completion endpoint is accessible without authentication."""
    mock_result = {"success": True, "message": "Onboarding completed successfully. Please login."}
    with patch.object(OnboardingService, 'complete_onboarding', return_value=mock_result):
        form_data = {
            "token": "valid-token-123",
            "password": "Password@123",
            "contact_number": "+91 9876543210",
            "emergency_contact": "John Doe - +91 9876543211",
            "dob": "1995-05-15",
            "current_address": "123 Main St",
            "permanent_address": "123 Main St",
            "bank_name": "Test Bank",
            "bank_account_no": "1234567890",
            "pan_no": "ABCDE1234F",
            "ifsc_code": "TEST0001234"
        }
        response = client.post("/api/onboarding/complete", data=form_data)
        assert response.status_code == 200
        assert response.json()["success"] is True

def test_invite_requires_auth():
    """Verify that protected onboarding endpoints still enforce authentication."""
    response = client.post("/api/onboarding/invite", json={
        "email": "test@example.com",
        "role": "employee",
        "first_name": "Test",
        "last_name": "User",
        "department": "Engineering",
        "designation": "Dev",
        "doj": "2026-09-10"
    })
    assert response.status_code in [401, 403]

def test_onboarding_service_verify_token_logic():
    """Test expiry logic and parsing in OnboardingService.verify_token."""
    svc = OnboardingService(tenant_id="public")

    # 1. Non-existent token
    svc.repo.get_invite_by_token = MagicMock(return_value=None)
    with pytest.raises(ValueError, match="Invalid onboarding token"):
        svc.verify_token("non-existent")

    # 2. Completed token
    svc.repo.get_invite_by_token = MagicMock(return_value={"status": "Completed"})
    with pytest.raises(ValueError, match="already been completed"):
        svc.verify_token("completed-1")

    # 3. Revoked token
    svc.repo.get_invite_by_token = MagicMock(return_value={"status": "Revoked"})
    with pytest.raises(ValueError, match="revoked by HR"):
        svc.verify_token("revoked-1")

    # 4. Valid token with naive future datetime
    svc.repo.get_invite_by_token = MagicMock(return_value={
        "token": "valid-1",
        "status": "Pending",
        "email": "jane@example.com",
        "name": "Jane Doe",
        "first_name": "Jane",
        "middle_name": "",
        "last_name": "Doe",
        "role": "employee",
        "department": "Tech",
        "designation": "Engineer",
        "expires_at": datetime.now() + timedelta(days=2)
    })
    res = svc.verify_token("valid-1")
    assert res["valid"] is True
    assert res["email"] == "jane@example.com"

    # 5. Expired token
    svc.repo.get_invite_by_token = MagicMock(return_value={
        "token": "expired-1",
        "status": "Pending",
        "email": "jane@example.com",
        "name": "Jane Doe",
        "first_name": "Jane",
        "middle_name": "",
        "last_name": "Doe",
        "role": "employee",
        "department": "Tech",
        "designation": "Engineer",
        "expires_at": datetime.now() - timedelta(days=1)
    })
    with pytest.raises(ValueError, match="expired"):
        svc.verify_token("expired-1")

def test_verify_token_route_aliases():
    """Test all route aliases for verify-token."""
    mock_data = {
        "valid": True,
        "email": "jane@example.com",
        "name": "Jane Doe",
        "first_name": "Jane",
        "middle_name": "",
        "last_name": "Doe",
        "role": "employee",
        "department": "Tech",
        "designation": "Engineer"
    }

    with patch.object(OnboardingService, 'verify_token', return_value=mock_data):
        # 1. /api/onboarding/verify-token (GET & POST)
        r = client.post("/api/onboarding/verify-token", json={"token": "tok1"})
        assert r.status_code == 200
        r = client.get("/api/onboarding/verify-token?token=tok1")
        assert r.status_code == 200

        # 2. /api/onboard/verify-token (GET & POST)
        r = client.post("/api/onboard/verify-token", json={"token": "tok1"})
        assert r.status_code == 200
        r = client.get("/api/onboard/verify-token?token=tok1")
        assert r.status_code == 200

        # 3. /api/auth/verify-token (GET & POST)
        r = client.post("/api/auth/verify-token", json={"token": "tok1"})
        assert r.status_code == 200
        r = client.get("/api/auth/verify-token?token=tok1")
        assert r.status_code == 200

