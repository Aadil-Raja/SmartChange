from sqlalchemy.orm import Session
from sqlalchemy import desc
from shared.models import Video


def create_video(
    db: Session,
    *,
    title: str,
    uploaded_by: int,
    cloudinary_public_id: str,
    cloudinary_url: str,
    cloudinary_thumbnail_url: str | None,
    duration_sec: int | None,
    mime_type: str | None,
    size_bytes: int | None,
) -> Video:
    v = Video(
        title=title,
        uploaded_by=uploaded_by,
        cloudinary_public_id=cloudinary_public_id,
        cloudinary_url=cloudinary_url,
        cloudinary_thumbnail_url=cloudinary_thumbnail_url,
        duration_sec=duration_sec,
        mime_type=mime_type,
        size_bytes=size_bytes,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def list_videos(db: Session) -> list[Video]:
    return db.query(Video).order_by(desc(Video.created_at)).all()


def get_video(db: Session, video_id: int) -> Video | None:
    return db.query(Video).filter(Video.id == video_id).first()


def delete_video(db: Session, video_id: int) -> None:
    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        db.delete(video)
        db.commit()
