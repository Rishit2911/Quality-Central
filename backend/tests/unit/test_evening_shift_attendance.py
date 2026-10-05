import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from backend.modules.deploy.services.attendance_service import (
    compute_shift_duration_and_status,
    AttendanceService
)
from backend.modules.deploy.schemas.attendance import ClockOutRequest, EditAttendanceRequest

def test_compute_duration_day_shift():
    hours, status = compute_shift_duration_and_status("09:00:00", "17:30:00")
    assert hours == 8.5
    assert status == "Present"

def test_compute_duration_evening_shift_crossing_midnight():
    # 18:00 to 02:30 (next morning) = 8.5 hours
    hours, status = compute_shift_duration_and_status("18:00:00", "02:30:00")
    assert hours == 8.5
    assert status == "Present"

def test_compute_duration_night_shift_full():
    # 20:00 to 05:00 = 9 hours
    hours, status = compute_shift_duration_and_status("20:00:00", "05:00:00")
    assert hours == 9.0
    assert status == "Present"

def test_compute_duration_evening_half_day():
    # 20:00 to 01:00 = 5 hours -> Half Day (Second Half)
    hours, status = compute_shift_duration_and_status("20:00:00", "01:00:00")
    assert hours == 5.0
    assert status == "Half Day (Second Half)"

def test_compute_duration_evening_absent_short():
    # 22:00 to 01:00 = 3 hours -> Absent (< 4 hours)
    hours, status = compute_shift_duration_and_status("22:00:00", "01:00:00")
    assert hours == 3.0
    assert status == "Absent"

def test_compute_duration_with_explicit_dates():
    # 2026-09-01 20:00 to 2026-09-02 04:30
    hours, status = compute_shift_duration_and_status(
        clock_in="20:00:00",
        clock_out="04:30:00",
        shift_date="2026-09-01",
        clock_out_date="2026-09-02"
    )
    assert hours == 8.5
    assert status == "Present"

def test_compute_duration_partial_pydantic_hh_mm():
    hours, status = compute_shift_duration_and_status("19:00", "03:30")
    assert hours == 8.5
    assert status == "Present"

def test_compute_duration_missing_clock_in_or_out():
    h1, s1 = compute_shift_duration_and_status("19:00", None)
    assert s1 == "Active"
    h2, s2 = compute_shift_duration_and_status(None, None)
    assert s2 == "Absent"

def test_clock_out_evening_shift_success():
    service = AttendanceService(tenant_id="test_tenant")
    service.repo = MagicMock()

    # Active shift started yesterday at 20:00
    service.repo.get_history.return_value = [{
        "id": 101,
        "employee_code": "EMP001",
        "date": "2026-09-01",
        "clock_in": "20:00:00",
        "clock_out": None,
        "status": "Active"
    }]

    # Employee clocks out on next calendar day (2026-09-02 at 04:30:00)
    req = ClockOutRequest(
        work_log="Completed night shift tasks",
        local_date="2026-09-02",
        local_time="04:30:00"
    )

    result = service.clock_out("EMP001", req)
    assert result["success"] is True
    assert result["status"] == "Present"
    assert result["duration_hours"] == 8.5

    # Verify repo.clock_out was called with shift start date (2026-09-01) and clock_out_date (2026-09-02)
    service.repo.clock_out.assert_called_once_with(
        "EMP001",
        "2026-09-01",
        "04:30:00",
        "Completed night shift tasks",
        "test_tenant",
        clock_out_date="2026-09-02",
        status="Present"
    )

def test_clock_out_shift_exceeding_20_hours():
    service = AttendanceService(tenant_id="test_tenant")
    service.repo = MagicMock()

    service.repo.get_history.return_value = [{
        "id": 101,
        "employee_code": "EMP001",
        "date": "2026-09-01",
        "clock_in": "08:00:00",
        "clock_out": None,
        "status": "Active"
    }]

    # Attempting to clock out 26 hours later
    req = ClockOutRequest(
        work_log="Forgot to clock out",
        local_date="2026-09-02",
        local_time="10:00:00"
    )

    with pytest.raises(ValueError, match="Shift duration exceeds 20 hours"):
        service.clock_out("EMP001", req)

def test_get_status_recognizes_active_yesterday_shift():
    service = AttendanceService(tenant_id="test_tenant")
    service.repo = MagicMock()

    # Yesterday's active record at 20:00
    yesterday = (datetime.now() - timedelta(hours=6)).strftime('%Y-%m-%d')
    service.repo.get_history.return_value = [{
        "id": 101,
        "employee_code": "EMP001",
        "date": yesterday,
        "clock_in": "20:00:00",
        "clock_out": None,
        "status": "Active"
    }]
    # Today has no record yet
    service.repo.get_todays_attendance.return_value = None

    status_resp = service.get_status("EMP001")
    assert status_resp.status == "clocked_in"
    assert status_resp.data.date == yesterday

def test_edit_attendance_overnight():
    service = AttendanceService(tenant_id="test_tenant")
    service.repo = MagicMock()

    req = EditAttendanceRequest(
        employee_code="EMP001",
        date="2026-09-01",
        clock_in="19:00:00",
        clock_out="03:30:00",
        work_log="Night shift support"
    )

    with patch("backend.modules.deploy.services.attendance_service.add_notification"):
        res = service.edit_attendance(req)
        assert res["success"] is True
        assert res["status"] == "Present"

    service.repo.upsert_attendance.assert_called_once_with(
        "EMP001",
        "2026-09-01",
        "19:00:00",
        "03:30:00",
        "Night shift support",
        "Present",
        "test_tenant",
        clock_out_date="2026-09-02"
    )

def test_grid_self_service_correction_evening_shift():
    service = AttendanceService(tenant_id="test_tenant")
    service.repo = MagicMock()
    service.holiday_repo = MagicMock()
    service.holiday_repo.get_holidays_in_range.return_value = []
    service.repo.get_todays_attendance.return_value = None

    # Simulate employee logging attendance for 2026-09-01 on client date 2026-09-02
    with patch("backend.modules.deploy.services.attendance_service.add_notification"):
        res = service.apply_self_service_correction(
            employee_code="EMP001",
            date_str="2026-09-01",
            clock_in="20:00:00",
            clock_out="04:30:00",
            reason="Evening Shift Daily Log",
            client_date="2026-09-02"
        )
        assert res["success"] is True
        assert res["status"] == "Present"

    # Verifies upsert was called with next-day clock_out_date
    service.repo.upsert_attendance.assert_called_once_with(
        employee_code="EMP001",
        date="2026-09-01",
        clock_in="20:00:00",
        clock_out="04:30:00",
        work_log="Self-service correction: Evening Shift Daily Log",
        status="Present",
        tenant_id="test_tenant",
        clock_out_date="2026-09-02"
    )

def test_grid_correction_request_and_manager_approval_evening_shift():
    service = AttendanceService(tenant_id="test_tenant")
    service.repo = MagicMock()
    service.holiday_repo = MagicMock()
    service.holiday_repo.get_holidays_in_range.return_value = []
    service.repo.get_manager_code.return_value = "MGR001"

    # Past date older than 2 weeks
    with patch("backend.modules.deploy.services.attendance_service.add_notification"):
        service.apply_correction_request(
            employee_code="EMP001",
            date_str="2026-08-01",
            clock_in="18:00:00",
            clock_out="02:30:00",
            reason="Late entry for evening shift",
            client_date="2026-09-02"
        )

    service.repo.create_correction_request.assert_called_once_with(
        employee_code="EMP001",
        date="2026-08-01",
        clock_in="18:00:00",
        clock_out="02:30:00",
        reason="Late entry for evening shift",
        tenant_id="test_tenant",
        clock_out_date="2026-08-02"
    )

    # Manager approves
    service.repo.get_correction_request_by_id.return_value = {
        "id": 50,
        "employee_code": "EMP001",
        "date": "2026-08-01",
        "clock_in": "18:00:00",
        "clock_out": "02:30:00",
        "clock_out_date": "2026-08-02",
        "reason": "Late entry for evening shift",
        "correction_track": "requested"
    }
    service.repo.get_user_role.return_value = "employee"
    service.repo.get_manager_code.return_value = "MGR001"
    service.repo.get_todays_attendance.return_value = None

    with patch("backend.modules.deploy.services.attendance_service.add_notification"):
        app_res = service.approve_reject_correction_request(
            correction_id=50,
            action="Approved",
            rejection_reason=None,
            admin_role="manager",
            admin_code="MGR001"
        )
        assert app_res["success"] is True

    service.repo.upsert_attendance.assert_called_once_with(
        employee_code="EMP001",
        date="2026-08-01",
        clock_in="18:00:00",
        clock_out="02:30:00",
        work_log="Correction approved by manager: Late entry for evening shift",
        status="Present",
        tenant_id="test_tenant",
        clock_out_date="2026-08-02"
    )
