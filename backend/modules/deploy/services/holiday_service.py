from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from backend.modules.deploy.repositories.holiday_repo import HolidayRepository
from backend.modules.deploy.schemas.holiday import HolidayCreate, HolidayUpdate

_IST = timezone(timedelta(hours=5, minutes=30))

class HolidayService:
    def __init__(self, tenant_id: str = 'public'):
        self.repo = HolidayRepository()
        self.tenant_id = tenant_id

    def get_holidays(self, year: Optional[int] = None) -> List[Dict[str, Any]]:
        if not year:
            year = datetime.now(_IST).year
        return self.repo.get_holidays_by_year(year, self.tenant_id)

    def get_upcoming_holidays(self, limit: int = 10) -> List[Dict[str, Any]]:
        today_str = datetime.now(_IST).strftime('%Y-%m-%d')
        year = datetime.now(_IST).year
        # Fetch current year and next year
        h_current = self.repo.get_holidays_by_year(year, self.tenant_id)
        h_next = self.repo.get_holidays_by_year(year + 1, self.tenant_id)
        all_holidays = h_current + h_next
        upcoming = [h for h in all_holidays if h['date'] >= today_str]
        upcoming.sort(key=lambda x: x['date'])
        return upcoming[:limit]

    def create_holiday(self, data: HolidayCreate, created_by: Optional[str] = None) -> Dict[str, Any]:
        # Validate date format
        try:
            datetime.strptime(data.date, '%Y-%m-%d')
        except ValueError:
            raise ValueError("Invalid date format. Must be YYYY-MM-DD.")

        # Check for duplicate date + name
        existing = self.repo.get_holiday_by_date_and_name(data.date, data.name, self.tenant_id)
        if existing:
            raise ValueError(f"Holiday '{data.name}' on {data.date} already exists.")

        return self.repo.create_holiday(
            name=data.name.strip(),
            date=data.date,
            holiday_type=data.holiday_type or 'regular_holiday',
            description=data.description.strip() if data.description else None,
            is_half_day=data.is_half_day,
            created_by=created_by,
            tenant_id=self.tenant_id
        )

    def update_holiday(self, holiday_id: int, data: HolidayUpdate) -> Dict[str, Any]:
        existing = self.repo.get_holiday_by_id(holiday_id, self.tenant_id)
        if not existing:
            raise ValueError("Holiday not found.")

        if data.date:
            try:
                datetime.strptime(data.date, '%Y-%m-%d')
            except ValueError:
                raise ValueError("Invalid date format. Must be YYYY-MM-DD.")

        name = data.name.strip() if data.name is not None else None
        desc = data.description.strip() if data.description is not None else None

        updated = self.repo.update_holiday(
            holiday_id=holiday_id,
            name=name,
            date=data.date,
            holiday_type=data.holiday_type,
            description=desc,
            is_half_day=data.is_half_day,
            tenant_id=self.tenant_id
        )
        if not updated:
            raise ValueError("Failed to update holiday.")
        return updated

    def delete_holiday(self, holiday_id: int) -> Dict[str, Any]:
        existing = self.repo.get_holiday_by_id(holiday_id, self.tenant_id)
        if not existing:
            raise ValueError("Holiday not found.")
        success = self.repo.delete_holiday(holiday_id, self.tenant_id)
        if not success:
            raise ValueError("Failed to delete holiday.")
        return {"success": True, "message": f"Holiday '{existing['name']}' deleted successfully."}
