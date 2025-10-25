from sqlalchemy.orm import Session
from app.repositories import videos_repo
from app.services.storage.storage_cloudinary import upload_video_bytes, delete_video_from_cloudinary
from shared.schemas.training_admin import VideoCreate
from app.services.storage.storage_cloudinary import delete_with_thumbnail

def upload_video(
    db: Session,
    *,
    admin_id: int,
    file_bytes: bytes,
    filename: str,
    title: str,
    mime: str | None,
):
    if not title:
        raise ValueError("Title is required")
    if not file_bytes:
        raise ValueError("File is empty")
    
    # Check if filename ends with .mp4
    if not filename or not filename.lower().endswith('.mp4'):
        raise ValueError("Only .mp4 files are allowed")
    
    meta = upload_video_bytes(file_bytes=file_bytes, filename=filename)
    
    v = videos_repo.create_video(
        db,
        title=title,
        uploaded_by=admin_id,
        cloudinary_public_id=meta["public_id"],
        cloudinary_url=meta["secure_url"],
        cloudinary_thumbnail_url=meta["thumbnail_url"],
        duration_sec=meta.get("duration_sec"),
        mime_type=mime or "video/mp4",
        size_bytes=meta.get("size_bytes"),
    )
    
    return {
        "id": v.id,
        "title": v.title,
        "thumbnail_url": v.cloudinary_thumbnail_url,
        "secure_url": v.cloudinary_url,
        "duration_sec": v.duration_sec,
    }

def list_videos(db: Session):
    rows = videos_repo.list_videos(db)
    return [
        {
            "id": r.id,
            "title": r.title,
            "thumbnail_url": r.cloudinary_thumbnail_url,
            "secure_url": r.cloudinary_url,
            "duration_sec": r.duration_sec,
            "created_at": r.created_at,
        }
        for r in rows
    ]


def get_video_by_id(db: Session, video_id: int):
    row = videos_repo.get_video(db, video_id)
    if not row:
        raise ValueError(f"Video with id {video_id} not found")
    
    return {
        "id": row.id,
        "title": row.title,
        "thumbnail_url": row.cloudinary_thumbnail_url,
        "secure_url": row.cloudinary_url,
        "duration_sec": row.duration_sec,
        "mime_type": row.mime_type,
        "size_bytes": row.size_bytes,
        "created_at": row.created_at,
    }


def delete_video(db: Session, video_id: int):
    video = videos_repo.get_video(db, video_id)
    if not video:
        raise ValueError(f"Video with id {video_id} not found")
    
    # Delete from Cloudinary
    try:
        delete_with_thumbnail(video.cloudinary_public_id)
    except Exception as e:
        # Log the error but continue with DB deletion
        print(f"Warning: Failed to delete video from Cloudinary: {e}")
    
    # Delete from database
    videos_repo.delete_video(db, video_id)
    
    return {"id": video_id, "deleted": True}