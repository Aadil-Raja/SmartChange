# ============================================================================
# FILE: app/repositories/courseContent_repo.py
# ============================================================================
from sqlalchemy.orm import Session , joinedload
from typing import Optional, List ,Dict, Any
from shared.models.course import Course
from shared.models.course_content import ContentItem, ContentType
from shared.models.Video import Video
from shared.models.external_link import ExternalLink

# ---- serializers (simple & explicit) ----
def course_to_dict(c: Course) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "department": c.department,
        "thumbnail_url": c.thumbnail_url,
        "is_active": bool(c.is_active),
        "deadline_weeks": c.deadline_weeks,
        "created_at": c.created_at,
    }

def quiz_to_dict(q) -> dict:
    """Convert CourseQuiz to dictionary"""
    return {
        "id": q.id,
        "course_id": q.course_id,
        "title": q.title,
        "description": q.description,
        "total_questions": q.total_questions,
        "status": q.status.value if hasattr(q.status, 'value') else str(q.status),
        "created_by": q.created_by,
        "created_at": q.created_at,
        "updated_at": q.updated_at,
        "published_at": q.published_at,
    }

def item_to_dict(i: ContentItem) -> dict:
    content_type = i.type.value if hasattr(i.type, "value") else str(i.type)

    if content_type == "document":
        access_url = i.document.cloudinary_url if i.document else None
        thumbnail_url=i.document.cloudinary_thumbnail_url if i.document else None
    elif content_type == "video":
        access_url = i.video.cloudinary_url if i.video else None
        thumbnail_url=i.video.cloudinary_thumbnail_url if i.video else None
    elif content_type == "link":
        access_url = i.external_link.url if i.external_link else None
        thumbnail_url=None
    else:
        access_url = None
        thumbnail_url = None

    return {
        "id": i.id,
        "course_id": i.course_id,
        "title": i.title,
        "description": i.description,
        "type": content_type,
        "order_index": i.order_index,
        "document_id": i.document_id,
        "video_id": i.video_id,
        "external_link_id": i.external_link_id,
        "created_at": i.created_at,
        "thumbnail_url": thumbnail_url,
        "access_url": access_url,
    }

# ---- courses ----
def create_course(db: Session, *, title: str, description: Optional[str], department: Optional[str], created_by: int) -> Course:
    course = Course(
        title=title,
        description=description,
        department=department,
        created_by=created_by,
        is_active=False,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course

def update_course(db: Session, *, course_id: int, values: dict) -> Optional[Course]:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return None
    for k, v in values.items():
        setattr(course, k, v)
    db.commit()
    db.refresh(course)
    return course

def set_course_thumbnail(db: Session, *, course_id: int, url: str, public_id: str) -> Optional[Course]:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return None
    course.thumbnail_url = url
    course.thumbnail_public_id = public_id
    db.commit()
    db.refresh(course)
    return course

def get_course(db: Session, *, course_id: int) -> Optional[Course]:
    return db.query(Course).filter(Course.id == course_id).first()

def list_courses(db: Session, active_only: bool = False):
    query = db.query(Course)
    if active_only:
        query = query.filter(Course.is_active == True)
    return query.order_by(Course.created_at.desc()).all()

def delete_course(db: Session, course_id: int) -> bool:
    """Hard-delete a course and cascade delete its content items."""
    course = get_course(db, course_id=course_id)
    if not course:
        return False
    db.delete(course)
    db.commit()
    return True

def set_course_active(db: Session, course_id: int, is_active: bool) -> bool:
    """
    Soft-toggle is_active.
    """
    course = get_course(db, course_id=course_id)
    if not course:
        return False
    course.is_active = is_active
    db.add(course)
    db.commit()
    db.refresh(course)
    return True

def delete_course_thumbnail(db: Session, course_id: int) -> bool:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return False

    if not course.thumbnail_url:
        return True  # nothing to delete

    # Clear fields
    course.thumbnail_url = None
    course.thumbnail_public_id = None

    db.commit()
    db.refresh(course)
    return True


# ---- content items ----
def list_items_for_course(db: Session, *, course_id: int, published_only: bool = False) -> List[ContentItem]:
    query = (
        db.query(ContentItem)
        .options(
            joinedload(ContentItem.document),
            joinedload(ContentItem.video),
            joinedload(ContentItem.external_link),
        )
        .filter(ContentItem.course_id == course_id)
    )
    
    # Order by order_index for proper sequencing
    return query.order_by(ContentItem.order_index.asc()).all()
def add_content_item(
    db: Session,
    *,
    course_id: int,
    title: str,
    description: Optional[str],
    type_str: str,
    document_id: Optional[int],
    video_id: Optional[int],
    external_link_id: Optional[int],
    order_index: Optional[int] = None,
) -> ContentItem:
    # Validate enum value
    try:
        content_type = ContentType(type_str)
    except ValueError:
        raise ValueError(f"Invalid content type: {type_str}. Must be one of: document, video, link")

    # Prevent adding the same asset twice to the same course
    if type_str == "document" and document_id:
        exists = db.query(ContentItem).filter(
            ContentItem.course_id == course_id,
            ContentItem.document_id == document_id,
        ).first()
        if exists:
            raise ValueError("This document is already added to the course.")
    elif type_str == "video" and video_id:
        exists = db.query(ContentItem).filter(
            ContentItem.course_id == course_id,
            ContentItem.video_id == video_id,
        ).first()
        if exists:
            raise ValueError("This video is already added to the course.")
    elif type_str == "link" and external_link_id:
        exists = db.query(ContentItem).filter(
            ContentItem.course_id == course_id,
            ContentItem.external_link_id == external_link_id,
        ).first()
        if exists:
            raise ValueError("This link is already added to the course.")
    
    # If no order_index provided, add to end
    if order_index is None:
        max_order = db.query(ContentItem).filter(ContentItem.course_id == course_id).count()
        order_index = max_order
    
    item = ContentItem(
        course_id=course_id,
        title=title,
        description=description,
        type=content_type,
        order_index=order_index,
        document_id=document_id,
        video_id=video_id,
        external_link_id=external_link_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

def get_content_item(db: Session, *, content_id: int) -> Optional[ContentItem]:
    return db.query(ContentItem).filter(ContentItem.id == content_id).first()

def update_content_item(db: Session, *, content_id: int, values: dict) -> Optional[ContentItem]:
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        return None
    
    # Validate type if it's being updated
    if "type" in values:
        try:
            values["type"] = ContentType(values["type"])
        except ValueError:
            raise ValueError(f"Invalid content type: {values['type']}. Must be one of: document, video, link")
    
    for k, v in values.items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item

def delete_content_item(db: Session, *, content_id: int) -> bool:
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        return False
    course_id = item.course_id
    db.delete(item)
    db.commit()

    # Remove deleted content_id from prerequisite_content_ids of all quizzes in this course
    _remove_prerequisite_from_course_quizzes(db, course_id=course_id, content_id=content_id)

    # Re-check completion for all enrolled users.
    # If this was the last incomplete item, the user is now done and needs completed_at set.
    _recheck_course_completion_for_all_users(db, course_id=course_id)

    return True


def _recheck_course_completion_for_all_users(db: Session, *, course_id: int) -> None:
    """
    After a content item is deleted, check every enrolled user.
    If all remaining items are completed, set CourseEnrollment.completed_at.
    """
    from datetime import datetime, timezone
    from shared.models.course_enrollment import CourseEnrollment
    from shared.models.progress import UserProgress
    from shared.repos.course_quiz_repo import get_course_quizzes_by_course
    from shared.models.course_quiz import QuizStatus
    from shared.repos.quiz_attempt_repo import get_user_quiz_attempts

    # Remaining content items after the deletion
    remaining_items = db.query(ContentItem).filter(ContentItem.course_id == course_id).all()
    remaining_content_ids = {it.id for it in remaining_items}

    # Published quizzes
    published_quizzes = get_course_quizzes_by_course(db, course_id, QuizStatus.PUBLISHED)

    # Only check enrollments that are not yet completed
    enrollments = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.completed_at.is_(None),
        )
        .all()
    )

    now = datetime.now(timezone.utc)
    for enrollment in enrollments:
        user_id = enrollment.user_id

        # Check content items — all remaining must be completed
        if remaining_content_ids:
            progress_rows = (
                db.query(UserProgress)
                .filter(
                    UserProgress.user_id == user_id,
                    UserProgress.content_id.in_(remaining_content_ids),
                )
                .all()
            )
            done_ids = {
                r.content_id for r in progress_rows
                if r.completed_at is not None or (r.progress or 0) >= 100.0
            }
            if not remaining_content_ids.issubset(done_ids):
                continue  # still has incomplete content items

        # Check quizzes — all published quizzes must be passed
        all_quizzes_passed = all(
            any(a.passed for a in get_user_quiz_attempts(db, user_id, quiz.id))
            for quiz in published_quizzes
        )
        if not all_quizzes_passed:
            continue

        # All content done and all quizzes passed — mark complete
        enrollment.completed_at = now

    db.commit()


def _remove_prerequisite_from_course_quizzes(db: Session, *, course_id: int, content_id: int) -> None:
    """Strip a deleted content item ID from all course quiz prerequisite lists."""
    from shared.models.course_quiz import CourseQuiz
    quizzes = db.query(CourseQuiz).filter(CourseQuiz.course_id == course_id).all()
    for quiz in quizzes:
        if quiz.prerequisite_content_ids and content_id in quiz.prerequisite_content_ids:
            quiz.prerequisite_content_ids = [
                pid for pid in quiz.prerequisite_content_ids if pid != content_id
            ]
    db.commit()



def list_courses_by_ids(db: Session, *, course_ids: List[int]) -> List[Dict[str, Any]]:
    """
    Get multiple courses by their IDs.
    Returns list of course dictionaries.
    """
    from shared.models.course import Course
    
    courses = (
        db.query(Course)
        .filter(Course.id.in_(course_ids))
        .all()
    )
    
    return [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "is_active": c.is_active,
            "department": c.department,
            "thumbnail_url": c.thumbnail_url,
            "deadline_weeks": c.deadline_weeks,
        }
        for c in courses
    ]


def list_quizzes_for_course(db: Session, *, course_id: int, user_id: Optional[int] = None, published_only: bool = False):
    """Get all quizzes for a course with optional published-only filtering and unlock status"""
    from shared.models.course_quiz import CourseQuiz, QuizStatus
    from shared.repos.course_quiz_repo import get_course_quizzes_with_unlock_status
    
    if user_id and published_only:
        # For employees - get published quizzes with unlock status
        return get_course_quizzes_with_unlock_status(db, course_id, user_id, QuizStatus.PUBLISHED)
    else:
        # For admins - get all quizzes without unlock status
        query = db.query(CourseQuiz).filter(CourseQuiz.course_id == course_id)
        
        if published_only:
            query = query.filter(CourseQuiz.status == QuizStatus.PUBLISHED)
        
        quizzes = query.order_by(CourseQuiz.created_at.asc()).all()
        
        # Convert to dict format for consistency
        quiz_list = []
        for quiz in quizzes:
            quiz_data = {
                "id": quiz.id,
                "course_id": quiz.course_id,
                "title": quiz.title,
                "description": quiz.description,
                "total_questions": quiz.total_questions,
                "prerequisite_content_ids": quiz.prerequisite_content_ids,
                "status": quiz.status.value if hasattr(quiz.status, 'value') else quiz.status,
                "created_by": quiz.created_by,
                "created_at": quiz.created_at,
                "updated_at": quiz.updated_at,
                "published_at": quiz.published_at
            }
            quiz_list.append(quiz_data)
        
        return quiz_list


def reorder_content_items(db: Session, *, course_id: int, item_orders: List[dict]) -> bool:
    """
    Reorder content items for a course.
    
    Args:
        course_id: ID of the course
        item_orders: List of {"id": item_id, "order_index": new_order} dicts
    
    Returns:
        bool: True if successful
    """
    try:
        for item_order in item_orders:
            item_id = item_order["id"]
            new_order = item_order["order_index"]
            
            item = db.query(ContentItem).filter(
                ContentItem.id == item_id,
                ContentItem.course_id == course_id
            ).first()
            
            if item:
                item.order_index = new_order
        
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False


def get_next_content_order_index(db: Session, *, course_id: int) -> int:
    """Get the next available order index for a course"""
    max_order = db.query(ContentItem).filter(ContentItem.course_id == course_id).count()
    return max_order


def get_content_items_by_ids(db: Session, *, item_ids: List[int], course_id: int) -> List[ContentItem]:
    """Get content items by IDs, ensuring they belong to the specified course"""
    return (
        db.query(ContentItem)
        .filter(
            ContentItem.id.in_(item_ids),
            ContentItem.course_id == course_id
        )
        .all()
    )


# ---- deadline management ----
def set_course_deadline(db: Session, *, course_id: int, deadline_weeks: Optional[int]) -> Optional[Course]:
    """
    Set or update the deadline for a course.
    
    Args:
        course_id: ID of the course
        deadline_weeks: Number of weeks for deadline, or None to remove deadline
    
    Returns:
        Updated Course object or None if not found
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return None
    
    course.deadline_weeks = deadline_weeks
    db.commit()
    db.refresh(course)
    return course