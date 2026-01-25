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
        is_active=True,
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
    db.delete(item)
    db.commit()
    return True



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