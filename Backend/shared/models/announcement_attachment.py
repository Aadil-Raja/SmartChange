from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, Enum as SQLEnum
from sqlalchemy.orm import relationship
from .user import Base
import enum

class AttachmentType(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"
    PDF = "pdf"

class AnnouncementAttachment(Base):
    __tablename__ = "announcement_attachments"

    id = Column(Integer, primary_key=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    attachment_type = Column(SQLEnum(AttachmentType), nullable=False)
    cloudinary_url = Column(String, nullable=False)
    cloudinary_public_id = Column(String, nullable=False)
    cloudinary_thumbnail_url = Column(String, nullable=True)  # For PDF and video
    original_filename = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    announcement = relationship("Announcement", back_populates="attachments")
