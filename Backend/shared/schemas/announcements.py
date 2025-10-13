from pydantic import BaseModel, Field

class AnnouncementCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)

class AnnouncementOut(BaseModel):
    id: int
    team_id: int
    author_id: int
    title: str
    body: str
    created_at: str
    class Config: from_attributes = True

class CommentCreateIn(BaseModel):
    body: str = Field(min_length=1)

class CommentOut(BaseModel):
    id: int
    announcement_id: int
    user_id: int
    body: str
    created_at: str
    class Config: from_attributes = True

class AnnouncementWithComments(BaseModel):
    announcement: AnnouncementOut
    comments: list[CommentOut]
