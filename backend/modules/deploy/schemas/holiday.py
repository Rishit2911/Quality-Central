from pydantic import BaseModel, Field
from typing import Optional, Any, Union
from datetime import datetime

class HolidayCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    holiday_type: str = Field(default='regular_holiday')  # 'national_holiday', 'regular_holiday', 'restricted_holiday'
    description: Optional[str] = None
    is_half_day: bool = False

class HolidayUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    date: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    holiday_type: Optional[str] = None
    description: Optional[str] = None
    is_half_day: Optional[bool] = None

class HolidayOut(BaseModel):
    id: int
    name: str
    date: str
    holiday_type: str
    description: Optional[str] = None
    is_half_day: bool = False
    created_by: Optional[str] = None
    created_at: Optional[Union[str, datetime, Any]] = None

