from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from backend.core.dependencies import get_current_user, require_permission
from backend.modules.deploy.services.holiday_service import HolidayService
from backend.modules.deploy.schemas.holiday import HolidayCreate, HolidayUpdate, HolidayOut
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attendance/holidays", tags=["Attendance Holidays"])

def get_holiday_service(user=Depends(get_current_user)) -> HolidayService:
    return HolidayService(tenant_id=user.get('tenant_id', 'public'))

@router.get("", response_model=List[HolidayOut])
def get_holidays(
    year: Optional[int] = Query(None, description="Year to filter holidays for (e.g. 2026)"),
    user=Depends(get_current_user),
    service: HolidayService = Depends(get_holiday_service)
):
    """Retrieve all company holidays for a given year (defaults to current year). Accessible by all employees."""
    try:
        return service.get_holidays(year)
    except Exception as e:
        logger.exception("Failed to fetch holidays: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch company holidays.")

@router.get("/upcoming", response_model=List[HolidayOut])
def get_upcoming_holidays(
    limit: int = Query(10, ge=1, le=50),
    user=Depends(get_current_user),
    service: HolidayService = Depends(get_holiday_service)
):
    """Retrieve upcoming company holidays from today onwards. Accessible by all employees."""
    try:
        return service.get_upcoming_holidays(limit)
    except Exception as e:
        logger.exception("Failed to fetch upcoming holidays: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch upcoming holidays.")

@router.post("", response_model=HolidayOut)
def create_holiday(
    data: HolidayCreate,
    user=Depends(require_permission("deploy.attendance.manage_policies")),
    service: HolidayService = Depends(get_holiday_service)
):
    """Admin / HR: Add a new company holiday, national holiday, or festival."""
    try:
        return service.create_holiday(data, created_by=user.get('employee_code'))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create holiday: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create holiday.")

@router.put("/{holiday_id}", response_model=HolidayOut)
def update_holiday(
    holiday_id: int,
    data: HolidayUpdate,
    user=Depends(require_permission("deploy.attendance.manage_policies")),
    service: HolidayService = Depends(get_holiday_service)
):
    """Admin / HR: Update an existing company holiday."""
    try:
        return service.update_holiday(holiday_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to update holiday %s: %s", holiday_id, e)
        raise HTTPException(status_code=500, detail="Failed to update holiday.")

@router.delete("/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    user=Depends(require_permission("deploy.attendance.manage_policies")),
    service: HolidayService = Depends(get_holiday_service)
):
    """Admin / HR: Delete a company holiday."""
    try:
        return service.delete_holiday(holiday_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to delete holiday %s: %s", holiday_id, e)
        raise HTTPException(status_code=500, detail="Failed to delete holiday.")
