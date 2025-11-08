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