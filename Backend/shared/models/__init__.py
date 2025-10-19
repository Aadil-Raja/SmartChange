# SHARED: SQLAlchemy ORM models used across all services
# This file contains the base database models that can be imported by any service

from .user import User, Base, UserRole
from .email_otp import EmailOTP
from .team import Team, TeamMember,TeamMemberRole
from .Document import Document,DocStatus, DocumentChunk
from .announcement import Announcement, AnnouncementComment
from .course import Course
from .course_content import ContentItem, ContentType
from .Audit import DocumentProcessingAudit, ProcessingStatus, ProcessingStage
__all__ = ["User", "EmailOTP", "Base", "Team", "TeamMember","TeamMemberRole", "UserRole","Document","DocStatus","Announcement", "AnnouncementComment","DocumentChunk","Course","ContentItem","ContentType","DocumentProcessingAudit","ProcessingStatus","ProcessingStage"]

