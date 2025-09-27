# SHARED: Document Pydantic schemas used across all services
# These schemas provide validation and serialization for document data

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DocumentBase(BaseModel):
    """Base document schema with common fields"""
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    file_path: Optional[str] = Field(None, max_length=500)
    file_type: Optional[str] = Field(None, max_length=50)
    file_size: Optional[int] = Field(None, ge=0)
    is_public: bool = False

class DocumentCreate(DocumentBase):
    """Schema for creating a new document"""
    owner_id: int

class DocumentUpdate(BaseModel):
    """Schema for updating document data"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    file_path: Optional[str] = Field(None, max_length=500)
    file_type: Optional[str] = Field(None, max_length=50)
    file_size: Optional[int] = Field(None, ge=0)
    is_public: Optional[bool] = None

class DocumentResponse(DocumentBase):
    """Schema for document response data"""
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
