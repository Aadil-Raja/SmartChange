from sqlalchemy.orm import Session, joinedload
from shared.models import Announcement, AnnouncementComment, TeamMember, AnnouncementAttachment, AttachmentType


def create_announcement(db: Session, *, team_id: int, author_id: int, title: str, body: str) -> Announcement:
    a = Announcement(team_id=team_id, author_id=author_id, title=title.strip(), body=body.strip())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a

def list_team_announcements(db: Session, *, team_id: int) -> list[Announcement]:
    return db.query(Announcement).filter(Announcement.team_id == team_id).order_by(Announcement.id.desc()).all()

def get_announcement(db: Session, *, announcement_id: int) -> Announcement | None:
    return db.query(Announcement).filter(Announcement.id == announcement_id).first()

def update_announcement(db: Session, *, announcement_id: int, title: str | None, body: str | None) -> Announcement:
    a = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if a:
        # Only update fields that are provided
        if title is not None:
            a.title = title.strip()
        if body is not None:
            a.body = body.strip()
        db.commit()
        db.refresh(a)
    return a

def delete_announcement(db: Session, *, announcement_id: int) -> None:
    a = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if a:
        db.delete(a)
        db.commit()

def add_comment(db: Session, *, announcement_id: int, user_id: int, body: str) -> AnnouncementComment:
    c = AnnouncementComment(announcement_id=announcement_id, user_id=user_id, body=body.strip())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

def get_comment(db: Session, *, comment_id: int) -> AnnouncementComment | None:
    return db.query(AnnouncementComment).filter(AnnouncementComment.id == comment_id).first()

def delete_comment(db: Session, *, comment_id: int) -> None:
    c = db.query(AnnouncementComment).filter(AnnouncementComment.id == comment_id).first()
    if c:
        db.delete(c)
        db.commit()

def get_team_members(db: Session, *, team_id: int) -> list[TeamMember]:
    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id)
        .order_by(TeamMember.role_in_team.desc(), TeamMember.created_at.asc())
        .all()
    )

# Attachment functions
def create_attachment(
    db: Session, 
    *, 
    announcement_id: int, 
    attachment_type: AttachmentType,
    cloudinary_url: str,
    cloudinary_public_id: str,
    cloudinary_thumbnail_url: str | None = None,
    original_filename: str | None = None,
    size_bytes: int | None = None
) -> AnnouncementAttachment:
    attachment = AnnouncementAttachment(
        announcement_id=announcement_id,
        attachment_type=attachment_type,
        cloudinary_url=cloudinary_url,
        cloudinary_public_id=cloudinary_public_id,
        cloudinary_thumbnail_url=cloudinary_thumbnail_url,
        original_filename=original_filename,
        size_bytes=size_bytes
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment

def get_attachment(db: Session, *, attachment_id: int) -> AnnouncementAttachment | None:
    return db.query(AnnouncementAttachment).filter(AnnouncementAttachment.id == attachment_id).first()

def list_announcement_attachments(db: Session, *, announcement_id: int) -> list[AnnouncementAttachment]:
    return db.query(AnnouncementAttachment).filter(
        AnnouncementAttachment.announcement_id == announcement_id
    ).order_by(AnnouncementAttachment.id.asc()).all()

def delete_attachment(db: Session, *, attachment_id: int) -> None:
    attachment = db.query(AnnouncementAttachment).filter(AnnouncementAttachment.id == attachment_id).first()
    if attachment:
        db.delete(attachment)
        db.commit()
