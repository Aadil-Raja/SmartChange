# ============================================================================
# FILE: shared/schemas/training_admin.py
# ============================================================================
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, Literal, List, Dict

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
    order_index: Optional[int] = Field(None, ge=0, description="Position in course sequence (0-based)")
  
    document_id: Optional[int] = None
    video_id: Optional[int] = None
    external_link_id: Optional[int] = None

class ContentItemUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    type: Optional[ContentType] = None  # Allow type updates
    order_index: Optional[int] = Field(None, ge=0, description="Position in course sequence (0-based)")
    
    document_id: Optional[int] = None
    video_id: Optional[int] = None
    external_link_id: Optional[int] = None


class ContentItemReorderIn(BaseModel):
    """Schema for reordering content items"""
    items: List[Dict[str, int]] = Field(
        ..., 
        description="List of {id: item_id, order_index: new_position} objects",
        example=[
            {"id": 1, "order_index": 0},
            {"id": 3, "order_index": 1}, 
            {"id": 2, "order_index": 2}
        ]
    )


class LinkCreate(BaseModel):
    title: str
    url: str

class VideoCreate(BaseModel):
    title: str

class LinkUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None

# 🆕 Deadline Management Schemas
class CourseDeadlineUpdate(BaseModel):
    """Schema for setting or removing course deadline"""
    deadline_weeks: Optional[int] = Field(
        None, 
        ge=1, 
        description="Number of weeks to complete the course. Set to null to remove deadline."
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "deadline_weeks": 4
            }
        }

# 🆕 NEW SCHEMA: Main Topics Update (Dictionary Format)
class MainTopicsUpdate(BaseModel):
    """
    Schema for updating main topics of a document.
    Topics are stored as key-value pairs where:
    - Key: Topic name (e.g., "AI", "Python")
    - Value: Description or sub-topics (e.g., "Machine learning, neural networks")
    """
    main_topics: Dict[str, str] = Field(
        ..., 
        description="Dictionary of topics with their descriptions/sub-topics",
        example={
            "AI": "Artificial Intelligence, machine learning, neural networks",
            "Python": "Programming fundamentals, data structures, OOP"
        }
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "main_topics": {
                    "AI": "Artificial Intelligence fundamentals, neural networks, deep learning",
                    "Data Science": "Statistical analysis, data visualization, pandas, numpy",
                    "Python": "Programming basics, data structures, algorithms"
                }
            }
        }