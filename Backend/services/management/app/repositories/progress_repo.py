# app/repositories/userProgress_repo.py
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, Iterable
from shared.models.progress import UserProgress


def get(db: Session, *, user_id: int, content_id: int) -> Optional[UserProgress]:
    return (
        db.query(UserProgress)
          .filter(UserProgress.user_id == user_id, UserProgress.content_id == content_id)
          .first()
    )


def upsert_progress(
    db: Session,
    *,
    user_id: int,
    content_id: int,
    progress: float,
    mark_complete: bool,
) -> UserProgress:
    row = get(db, user_id=user_id, content_id=content_id)
    if not row:
        row = UserProgress(user_id=user_id, content_id=content_id, progress=0.0)
        db.add(row)
    
    # never decrease progress
    row.progress = max(row.progress, progress)
    
    # completion rules
    if mark_complete or row.progress >= 100.0:
        row.progress = 100.0
        if not row.completed_at:  # Only set if not already completed
            row.completed_at = datetime.now(timezone.utc)
    
    row.last_viewed_at = datetime.now(timezone.utc)
    
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_for_user_and_content_ids(db: Session, *, user_id: int, content_ids: Iterable[int]) -> list[UserProgress]:
    return (
        db.query(UserProgress)
          .filter(UserProgress.user_id == user_id, UserProgress.content_id.in_(list(content_ids)))
          .all()
    )