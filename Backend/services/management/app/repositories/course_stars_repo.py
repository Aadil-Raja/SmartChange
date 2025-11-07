# app/repositories/course_stars_repo.py
from sqlalchemy.orm import Session
from typing import Optional, List
from shared.models.progress import UserCourseStar
from datetime import datetime, timezone


def star_course(db: Session, *, user_id: int, course_id: int) -> UserCourseStar:
    """Star/bookmark a course for a user (idempotent)"""
    existing = get_star(db, user_id=user_id, course_id=course_id)
    if existing:
        return existing
    
    star = UserCourseStar(
        user_id=user_id,
        course_id=course_id,
        starred_at=datetime.now(timezone.utc)
    )
    db.add(star)
    db.commit()
    db.refresh(star)
    return star


def unstar_course(db: Session, *, user_id: int, course_id: int) -> bool:
    """Remove star/bookmark from a course. Returns True if deleted, False if not found."""
    star = get_star(db, user_id=user_id, course_id=course_id)
    if not star:
        return False
    
    db.delete(star)
    db.commit()
    return True


def get_star(db: Session, *, user_id: int, course_id: int) -> Optional[UserCourseStar]:
    """Check if a user has starred a specific course"""
    return (
        db.query(UserCourseStar)
        .filter(
            UserCourseStar.user_id == user_id,
            UserCourseStar.course_id == course_id
        )
        .first()
    )


def is_starred(db: Session, *, user_id: int, course_id: int) -> bool:
    """Quick boolean check if course is starred"""
    return get_star(db, user_id=user_id, course_id=course_id) is not None


def list_starred_course_ids(db: Session, *, user_id: int) -> List[int]:
    """Get all course IDs starred by a user"""
    stars = (
        db.query(UserCourseStar.course_id)
        .filter(UserCourseStar.user_id == user_id)
        .all()
    )
    return [s[0] for s in stars]


def list_starred_courses(db: Session, *, user_id: int) -> List[UserCourseStar]:
    """Get all starred course records with relationships"""
    return (
        db.query(UserCourseStar)
        .filter(UserCourseStar.user_id == user_id)
        .order_by(UserCourseStar.starred_at.desc())
        .all()
    )