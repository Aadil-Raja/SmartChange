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
    video_id: Optional[int] = None
    external_link_id: Optional[int] = None

class ContentItemUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    type: Optional[ContentType] = None  # Allow type updates
    
    document_id: Optional[int] = None
    video_id: Optional[int] = None
    external_link_id: Optional[int] = None


class LinkCreate(BaseModel):
    title: str
    url: str

class VideoCreate(BaseModel):
    title: str

class LinkUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None