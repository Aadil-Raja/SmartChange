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
from .Video import Video
from .external_link import ExternalLink
from .progress import UserProgress, UserCourseStar
__all__ = ["User", "EmailOTP", "Base", "Team", "TeamMember","TeamMemberRole", "UserRole","Document","DocStatus","Announcement", "AnnouncementComment","DocumentChunk","Course","ContentItem","ContentType","DocumentProcessingAudit","ProcessingStatus","ProcessingStage","Video",
           "ExternalLink","UserProgress","UserCourseStar"]

