# ============================================================================
# FILE: shared/schemas/training_admin.py
# ============================================================================
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, Literal

# Keep type as plain strings (clean JSON in/out)
ContentType = Literal["document", "video", "link"]

class CourseCreateIn(BaseModel):
    title: str = Field(..., min_length=2)
    description: Optional[str] = None
    department: Optional[str] = None

class CourseUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=2)
    description: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None

class ContentItemCreateIn(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    type: ContentType
  
    document_id: Optional[int] = None
    storage_url: Optional[HttpUrl] = None
    external_url: Optional[HttpUrl] = None

class ContentItemUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None

    document_id: Optional[int] = None
    storage_url: Optional[HttpUrl] = None
    external_url: Optional[HttpUrl] = None