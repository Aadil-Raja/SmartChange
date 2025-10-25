# shared/models/video.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .user import Base 

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)


    # Cloudinary fields
    cloudinary_url = Column(String, nullable=False)     
    cloudinary_public_id = Column(String, nullable=False) 
    cloudinary_thumbnail_url = Column(String, nullable=False)     
    duration_sec = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
