from pydantic import BaseModel, Field
from typing import Optional

class AnnouncementCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    related_course_id: Optional[int] = None

class AnnouncementUpdateIn(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    body: str | None = Field(None, min_length=1)

class AnnouncementOut(BaseModel):
    id: int
    team_id: int
    author_id: int
    title: str
    body: str
    created_at: str
    related_course_id: Optional[int] = None
    class Config: 
        from_attributes = True

class CommentCreateIn(BaseModel):
    body: str = Field(min_length=1)

class CommentOut(BaseModel):
    id: int
    announcement_id: int
    user_id: int
    body: str
    created_at: str
    class Config: 
        from_attributes = True

class AttachmentOut(BaseModel):
    id: int
    attachment_type: str
    url: str
    thumbnail_url: Optional[str] = None
    filename: Optional[str] = None
    size_bytes: Optional[int] = None
    created_at: str
    class Config:
        from_attributes = True

class AnnouncementWithComments(BaseModel):
    announcement: AnnouncementOut
    comments: list[CommentOut]
    attachments: list[AttachmentOut] = []