from unittest.mock import MagicMock, patch
from backend.modules.admin.schemas.admin import UserResponse
from backend.modules.admin.services.admin_service import AdminService
from backend.modules.deploy.repositories.employee_repo import EmployeeRepository
from backend.modules.deploy.services.employee_service import EmployeeService


def test_user_response_schema_preserves_is_active():
    """Verify UserResponse schema includes is_active field."""
    active_user = UserResponse(
        id=1,
        username="john@company.com",
        role="employee",
        employee_code="EMP001",
        is_active=1
    )
    assert active_user.is_active == 1
    assert active_user.model_dump()["is_active"] == 1

    locked_user = UserResponse(
        id=2,
        username="jane@company.com",
        role="employee",
        employee_code="EMP002",
        is_active=0
    )
    assert locked_user.is_active == 0
    assert locked_user.model_dump()["is_active"] == 0

    # Default fallback is active (1)
    default_user = UserResponse(
        id=3,
        username="default@company.com",
        role="employee"
    )
    assert default_user.is_active == 1


@patch("backend.core.database.get_db_connection")
@patch("backend.modules.deploy.repositories.user_repo.UserRepository.get_user_by_id")
def test_toggle_user_active_locks_and_purges_sessions(mock_get_user, mock_conn):
    """Verify toggling active to False sets is_active=0 and deletes active sessions."""
    mock_get_user.return_value = {"id": 42, "username": "test@company.com"}
    mock_cursor = MagicMock()
    mock_db = MagicMock()
    mock_db.cursor.return_value = mock_cursor
    mock_conn.return_value = mock_db

    service = AdminService(tenant_id="tenant_acme")
    service.repo.log_action = MagicMock()

    # Lock user
    result = service.toggle_user_active(
        user_id=42,
        is_active=False,
        actor="admin",
        actor_role="org_admin"
    )
    assert result == {"success": True}

    # Verify UPDATE users is_active = 0
    update_calls = [
        call for call in mock_cursor.execute.call_args_list
        if "UPDATE users SET is_active" in str(call)
    ]
    assert len(update_calls) == 1
    assert update_calls[0][0][1] == (0, 42)

    # Verify session purge for locked user
    session_delete_calls = [
        call for call in mock_cursor.execute.call_args_list
        if "DELETE FROM public.sessions" in str(call)
    ]
    assert len(session_delete_calls) == 1
    assert session_delete_calls[0][0][1] == (42,)


@patch("backend.modules.deploy.repositories.employee_repo.get_db_connection")
def test_employee_repo_update_user_active_by_employee(mock_conn):
    """Verify update_user_active_by_employee updates users and removes sessions when deactivating."""
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [{"id": 101}]
    mock_db = MagicMock()
    mock_db.cursor.return_value = mock_cursor
    mock_conn.return_value = mock_db

    repo = EmployeeRepository()
    repo.update_user_active_by_employee(
        employee_code="EMP101",
        is_active=0,
        tenant_id="tenant_acme",
        fallback_email="emp101@company.com"
    )

    # Verify query for user matching employee_code or fallback email
    select_calls = [
        call for call in mock_cursor.execute.call_args_list
        if "SELECT id FROM users" in str(call)
    ]
    assert len(select_calls) == 1
    assert select_calls[0][0][1] == ("EMP101", "emp101@company.com")

    # Verify update to is_active = 0
    update_calls = [
        call for call in mock_cursor.execute.call_args_list
        if "UPDATE users SET is_active" in str(call)
    ]
    assert len(update_calls) == 1
    assert update_calls[0][0][1] == (0, [101])

    # Verify session purge
    session_calls = [
        call for call in mock_cursor.execute.call_args_list
        if "DELETE FROM public.sessions" in str(call)
    ]
    assert len(session_calls) == 1
    assert session_calls[0][0][1] == ([101],)


def test_employee_service_syncs_inactive_status_to_user_lock():
    """Verify update_employee calls repo to lock account when employment_status is set to Inactive."""
    service = EmployeeService(tenant_id="tenant_acme")
    service.repo = MagicMock()
    service.repo.get_employee_by_code.return_value = {
        "employee_code": "EMP200",
        "employment_status": "Active",
        "email_id": "active_user@company.com",
        "first_name": "Active",
        "last_name": "User"
    }
    service.repo.update_user_active_by_employee = MagicMock()

    service.update_employee("EMP200", {
        "employment_status": "Inactive"
    })

    service.repo.update_user_active_by_employee.assert_called_once_with(
        employee_code="EMP200",
        is_active=0,
        tenant_id="tenant_acme",
        fallback_email="active_user@company.com"
    )


def test_employee_service_syncs_active_status_reversal():
    """Verify update_employee calls repo to unlock account when status changes from Inactive to Active."""
    service = EmployeeService(tenant_id="tenant_acme")
    service.repo = MagicMock()
    service.repo.get_employee_by_code.return_value = {
        "employee_code": "EMP200",
        "employment_status": "Inactive",
        "email_id": "inactive_user@company.com",
        "first_name": "Inactive",
        "last_name": "User"
    }
    service.repo.update_user_active_by_employee = MagicMock()

    service.update_employee("EMP200", {
        "employment_status": "Active"
    })

    service.repo.update_user_active_by_employee.assert_called_once_with(
        employee_code="EMP200",
        is_active=1,
        tenant_id="tenant_acme",
        fallback_email="inactive_user@company.com"
    )


def test_employee_service_does_not_unintentionally_unlock_active_user():
    """Verify updating other fields when status was already Active doesn't touch user is_active."""
    service = EmployeeService(tenant_id="tenant_acme")
    service.repo = MagicMock()
    service.repo.get_employee_by_code.return_value = {
        "employee_code": "EMP200",
        "employment_status": "Active",
        "email_id": "user@company.com",
        "first_name": "Regular",
        "last_name": "User"
    }
    service.repo.update_user_active_by_employee = MagicMock()

    # Admin updates phone number, employment_status remains 'Active'
    service.update_employee("EMP200", {
        "contact_number": "9876543210",
        "employment_status": "Active"
    })

    # Should NOT call update_user_active_by_employee because status was already Active
    service.repo.update_user_active_by_employee.assert_not_called()


@patch("backend.modules.deploy.api.employees.add_notification")
@patch("backend.modules.deploy.api.employees.get_service")
def test_api_update_employee_allows_org_admin_job_fields(mock_get_service, mock_notify):
    """Verify PUT /api/employee preserves employment_status when called by org_admin."""
    from backend.modules.deploy.api.employees import update_employee
    mock_service = MagicMock()
    mock_service.update_employee.return_value = {"success": True}
    mock_get_service.return_value = mock_service

    current_user = {
        "id": 1,
        "username": "admin@company.com",
        "role": "org_admin",
        "roles": ["org_admin"],
        "tenant_id": "tenant_acme",
        "permissions": {}
    }

    data = {
        "first_name": "Test",
        "employment_status": "Inactive"
    }

    result = update_employee(employee_code="EMP001", data=data, current_user=current_user)
    assert result == {"success": True}

    # Verify employment_status was NOT stripped
    mock_service.update_employee.assert_called_once()
    called_data = mock_service.update_employee.call_args[0][1]
    assert "employment_status" in called_data
    assert called_data["employment_status"] == "Inactive"

