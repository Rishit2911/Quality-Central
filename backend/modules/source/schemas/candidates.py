from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class CandidateBase(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    total_experience_years: Optional[float] = None  # Changed to None instead of 0.0
    current_designation: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    primary_skills: Optional[List[str]] = None  # Made Optional
    secondary_skills: Optional[List[str]] = None  # Made Optional
    status: Optional[str] = "New"  # Made Optional with default
    source: Optional[str] = "Manual"  # Made Optional with default
    ai_summary: Optional[str] = None

class ExperienceSchema(BaseModel):
    company: Optional[str] = None
    designation: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    description: Optional[str] = None

class EducationSchema(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class CandidateCreate(CandidateBase):
    experience: Optional[List[ExperienceSchema]] = []  # Made Optional
    education: Optional[List[EducationSchema]] = []  # Made Optional

class CandidateResponse(CandidateBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CandidateStatusUpdate(BaseModel):
    status: str

class CandidateNoteCreate(BaseModel):
    content: str

class CandidateNoteResponse(BaseModel):
    id: int
    candidate_id: int
    author_name: Optional[str] = None
    content: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CandidateSearchFilters(BaseModel):
    status: Optional[str] = None
    skills: Optional[List[str]] = []
    min_experience: Optional[float] = None
    max_experience: Optional[float] = None
    source: Optional[str] = None
    search: Optional[str] = None