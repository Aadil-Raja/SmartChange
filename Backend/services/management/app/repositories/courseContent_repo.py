# ============================================================================
# FILE: app/repositories/courseContent_repo.py
# ============================================================================
from sqlalchemy.orm import Session
from typing import Optional, List
from shared.models.course import Course
from shared.models.course_content import ContentItem, ContentType

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

def item_to_dict(i: ContentItem) -> dict:
    return {
        "id": i.id,
        "course_id": i.course_id,
        "title": i.title,
        "description": i.description,
        "type": i.type.value if hasattr(i.type, "value") else str(i.type),
        "document_id": i.document_id,
        "storage_url": i.storage_url,
        "external_url": i.external_url,
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

def set_course_thumbnail(db: Session, *, course_id: int, url: str) -> Optional[Course]:
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return None
    course.thumbnail_url = url
    db.commit()
    db.refresh(course)
    return course

def get_course(db: Session, *, course_id: int) -> Optional[Course]:
    return db.query(Course).filter(Course.id == course_id).first()

def list_courses(db: Session) -> List[Course]:
    return db.query(Course).order_by(Course.created_at.desc()).all()

# ---- content items ----
def list_items_for_course(db: Session, *, course_id: int) -> List[ContentItem]:
    return (
        db.query(ContentItem)
          .filter(ContentItem.course_id == course_id)
          .order_by(ContentItem.id.asc())
          .all()
    )

def add_content_item(
    db: Session,
    *,
    course_id: int,
    title: str,
    description: Optional[str],
    type_str: str,
    document_id: Optional[int],
    storage_url: Optional[str],
    external_url: Optional[str],
) -> ContentItem:
    # Validate enum value
    try:
        content_type = ContentType(type_str)
    except ValueError:
        raise ValueError(f"Invalid content type: {type_str}. Must be one of: document, video, link")
    
    item = ContentItem(
        course_id=course_id,
        title=title,
        description=description,
        type=content_type,
        document_id=document_id,
        storage_url=storage_url,
        external_url=external_url,
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
            ContentType(values["type"])
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
