import pytest
from datetime import datetime, timedelta
from backend.modules.deploy.schemas.holiday import HolidayCreate, HolidayUpdate, HolidayOut

def test_holiday_create_schema_valid():
    h = HolidayCreate(
        name="Independence Day",
        date="2026-08-15",
        holiday_type="national_holiday",
        description="National holiday",
        is_half_day=False
    )
    assert h.name == "Independence Day"
    assert h.date == "2026-08-15"
    assert h.holiday_type == "national_holiday"
    assert h.is_half_day is False

def test_holiday_create_regular_and_restricted():
    h1 = HolidayCreate(
        name="Diwali",
        date="2026-11-08",
        holiday_type="regular_holiday"
    )
    assert h1.holiday_type == "regular_holiday"

    h2 = HolidayCreate(
        name="Govardhan Puja",
        date="2026-11-09",
        holiday_type="restricted_holiday"
    )
    assert h2.holiday_type == "restricted_holiday"

def test_holiday_create_schema_invalid_date():
    with pytest.raises(Exception):
        HolidayCreate(
            name="Republic Day",
            date="26-01-2026",  # Invalid format (must be YYYY-MM-DD)
            holiday_type="national_holiday"
        )

def test_holiday_update_schema():
    u = HolidayUpdate(name="Independence Day Celebration", is_half_day=True, holiday_type="regular_holiday")
    assert u.name == "Independence Day Celebration"
    assert u.is_half_day is True
    assert u.holiday_type == "regular_holiday"
    assert u.date is None

def test_leave_working_days_calculation_with_holidays():
    """Simulate working days deduction logic excluding declared holidays & weekends."""
    start_date = "2026-08-28"  # Friday
    end_date = "2026-09-01"    # Tuesday
    
    d1 = datetime.strptime(start_date, '%Y-%m-%d')
    d2 = datetime.strptime(end_date, '%Y-%m-%d')
    
    # Declare 2026-08-31 (Monday) as a company holiday
    holiday_dates = {
        "2026-08-31": {"name": "Raksha Bandhan", "is_half_day": False, "holiday_type": "regular_holiday"}
    }
    
    curr = d1
    days = 0.0
    while curr <= d2:
        d_str = curr.strftime('%Y-%m-%d')
        is_weekend = curr.weekday() >= 5
        is_holiday = d_str in holiday_dates
        
        if not is_weekend and not is_holiday:
            days += 1.0
        elif is_holiday and holiday_dates[d_str].get('is_half_day'):
            days += 0.5
        curr += timedelta(days=1)
        
    assert days == 2.0
