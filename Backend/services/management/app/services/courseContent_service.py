from sqlalchemy.orm import Session
from typing import List, Optional
from shared.schemas.training_admin import CourseCreateIn, CourseUpdateIn, ContentItemCreateIn, ContentItemUpdateIn
from app.repositories import courseContent_repo as repo
from app.services.storage.storage_cloudinary import upload_raw_bytes,upload_image_bytes
from app.services.storage.storage_cloudinary import delete_file_by_public_id

def _validate_content_payload(body: ContentItemCreateIn | ContentItemUpdateIn, type_str: str, creating=True):
    """Validate content payload based on type and operation."""
    if type_str == "document":
        if creating and not body.document_id:
            raise ValueError("document_id is required for type=document")
    elif type_str == "video":
        if creating and not body.video_id:
            raise ValueError("video_id is required for type=video")
    elif type_str == "link":
        if creating and not body.external_link_id:
            raise ValueError("external_link_id is required for type=link")
    else:
        raise ValueError(f"Invalid content type: {type_str}")


def _validate_type_specific_fields(values: dict, type_str: str):
    """
    Validate that only appropriate fields are being updated for the content type.
    Raises ValueError if wrong fields are provided.
    """
    # Define allowed fields for each type (besides title and description)
    type_field_map = {
        "document": {"document_id"},
        "video": {"video_id"},
        "link": {"external_link_id"}
    }
    
    allowed_fields = type_field_map.get(type_str, set())
    all_type_fields = {"document_id", "video_id", "external_link_id"}
    
    # Check if any disallowed type-specific fields are present
    for field in all_type_fields:
        if field in values and field not in allowed_fields:
            raise ValueError(f"Cannot update '{field}' for content type '{type_str}'. Only {allowed_fields} allowed.")


# ---------------------- COURSE ----------------------

def create_course(db: Session, *, admin_id: int, body: CourseCreateIn):
    course = repo.create_course(
        db,
        title=body.title,
        description=body.description,
        department=body.department,
        created_by=admin_id,
    )
    return {"course": repo.course_to_dict(course)}


def update_course(db: Session, *, course_id: int, body: CourseUpdateIn):
    values = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not values:
        raise ValueError("No fields to update")
    
    course = repo.update_course(db, course_id=course_id, values=values)
    if not course:
        raise ValueError("Course not found")
    return {"course": repo.course_to_dict(course)}


def list_courses(db: Session, active_only: bool = False):
    rows = repo.list_courses(db, active_only=active_only)
    return {"courses": [repo.course_to_dict(c) for c in rows]}

def get_course_with_items(db: Session, *, course_id: int, published_only: bool = False, user_role: str = "admin", user_id: Optional[int] = None):
    """
    Get course with content items and quizzes.
    
    Args:
        course_id: ID of the course
        published_only: If True, only return published quizzes (for employees)
        user_role: "admin" or "employee" - determines quiz filtering
        user_id: User ID for unlock status checking (required for employees)
    """
    course = repo.get_course(db, course_id=course_id)
    if not course:
        raise ValueError("Course not found")
    
    # Get content items (documents, videos, links)
    items = repo.list_items_for_course(db, course_id=course_id, published_only=published_only)
    
    # Get quizzes for this course with unlock status
    if user_role == "employee" and user_id:
        quizzes = repo.list_quizzes_for_course(db, course_id=course_id, user_id=user_id, published_only=True)
    else:
        quizzes = repo.list_quizzes_for_course(db, course_id=course_id, published_only=False)
    
    return {
        "course": repo.course_to_dict(course),
        "items": [repo.item_to_dict(i) for i in items],
        "quizzes": quizzes,  # Already in dict format
    }


def set_course_thumbnail(db: Session, *, course_id: int, file_bytes: bytes):
    # Check if course exists first
    course = repo.get_course(db, course_id=course_id)
    if not course:
        raise ValueError("Course not found")
    
    result = upload_image_bytes(file_bytes)
    url = result.get("secure_url")
    public_id = result.get("public_id")
    if not url:
        raise ValueError("Failed to upload thumbnail")
    if not public_id:
        raise ValueError("Failed to get public_id for thumbnail")
    
    course = repo.set_course_thumbnail(db, course_id=course_id, url=url, public_id=public_id)
    return {"course": repo.course_to_dict(course)}

def deactivate_course(db: Session, *, course_id: int) -> dict:
    ok = repo.set_course_active(db, course_id=course_id, is_active=False)
    if not ok:
        raise ValueError("Course not found")
    return {"updated": True, "is_active": False}

def activate_course(db: Session, *, course_id: int) -> dict:
    # Check if this is a re-publish (was previously active) by seeing if any enrollments exist
    from shared.models.course_enrollment import CourseEnrollment
    had_enrollments = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == course_id
    ).first() is not None

    ok = repo.set_course_active(db, course_id=course_id, is_active=True)
    if not ok:
        raise ValueError("Course not found")

    # Reopen any completed enrollments — course was edited while unpublished,
    # so employees who were marked done must complete the new material.
    from app.repositories import course_enrollment_repo as enrollment_repo
    reopened = enrollment_repo.reopen_completed_enrollments(db, course_id=course_id)

    # Notify enrolled users
    try:
        from shared.models.notification import NotificationType
        from shared.repos.notification_repo import bulk_create_notifications

        course = repo.get_course(db, course_id=course_id)
        enrolled_user_ids = [
            e.user_id for e in db.query(CourseEnrollment)
            .filter(CourseEnrollment.course_id == course_id).all()
        ]
        if enrolled_user_ids and course:
            if had_enrollments:
                # Re-publish: course was updated, tell enrolled users to review
                title = f"{course.title} has been updated"
                message = f'"{course.title}" has been updated with new content. Please review the latest material.'
            else:
                # First publish: course is now available
                title = f"{course.title} is now available"
                message = f'"{course.title}" has been published and is ready for you to start.'

            bulk_create_notifications(
                db,
                user_ids=enrolled_user_ids,
                type=NotificationType.SYSTEM,
                title=title,
                message=message,
                related_course_id=course_id,
            )
    except Exception:
        pass  # Never block activation due to notification failure

    return {"updated": True, "is_active": True}

def delete_course(db: Session, *, course_id: int) -> dict:
    ok = repo.delete_course(db, course_id=course_id)
    if not ok:
        raise ValueError("Course not found")
    return {"deleted": True}


def delete_thumbnail(db: Session, *, course_id: int) -> dict:
    course = repo.get_course(db, course_id=course_id)
    if not course:
        raise ValueError("Course not found")

    if not course.thumbnail_public_id:
        raise ValueError("Thumbnail not found")

    # delete from Cloudinary
    delete_file_by_public_id(course.thumbnail_public_id)

    # clear from DB
    ok = repo.delete_course_thumbnail(db, course_id)
    if not ok:
        raise ValueError("Failed to update database record")

    return {"deleted": True}


# ---------------------- CONTENT ----------------------

def add_content_item(db: Session, *, course_id: int, body: ContentItemCreateIn):
    # Validate content type requirements
    _validate_content_payload(body, body.type, creating=True)
    
    # Verify course exists
    course = repo.get_course(db, course_id=course_id)
    if not course:
        raise ValueError("Course not found")
    
    item = repo.add_content_item(
        db,
        course_id=course_id,
        title=body.title,
        description=body.description,
        type_str=body.type,
        order_index=body.order_index,
        document_id=body.document_id if body.type == "document" else None,
        video_id=body.video_id if body.type == "video" else None,
        external_link_id=body.external_link_id if body.type == "link" else None,
    )

    return {"item": repo.item_to_dict(item)}
def update_content_item(db: Session, *, content_id: int, body: ContentItemUpdateIn):
    item = repo.get_content_item(db, content_id=content_id)
    if not item:
        raise ValueError("Content item not found")

    # Get current type
    type_str = item.type.value if hasattr(item.type, "value") else str(item.type)
    
    values = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    
    if not values:
        raise ValueError("No fields to update")

    # If type is being updated, validate the change
    new_type = values.get("type", type_str)
    if new_type != type_str:
        # Type is changing - clear old IDs and validate new requirements
        values["document_id"] = None
        values["video_id"] = None
        values["external_link_id"] = None
        
        # Now validate that the required ID for the new type is present
        if new_type == "document" and not values.get("document_id"):
            raise ValueError("document_id is required when changing to type=document")
        elif new_type == "video" and not values.get("video_id"):
            raise ValueError("video_id is required when changing to type=video")
        elif new_type == "link" and not values.get("external_link_id"):
            raise ValueError("external_link_id is required when changing to type=link")
    else:
        # Type is NOT changing - validate that only appropriate fields are being updated
        _validate_type_specific_fields(values, type_str)
        
        # Validate the merged state to ensure type requirements are still met
        after_doc = values.get("document_id", item.document_id)
        after_video = values.get("video_id", item.video_id)
        after_link = values.get("external_link_id", item.external_link_id)
        
        # Create validation object with merged state
        validation_obj = ContentItemCreateIn(
            title=item.title,
            description=item.description,
            type=type_str,
            document_id=after_doc,
            video_id=after_video,
            external_link_id=after_link
        )
        _validate_content_payload(validation_obj, type_str, creating=True)

    updated = repo.update_content_item(db, content_id=content_id, values=values)
    return {"item": repo.item_to_dict(updated)}


def delete_content_item(db: Session, *, content_id: int):
    ok = repo.delete_content_item(db, content_id=content_id)
    if not ok:
        raise ValueError("Content item not found")
    return {"deleted": True}


def reorder_content_items(db: Session, *, course_id: int, item_orders: List[dict]):
    """Reorder content items for a course"""
    # Verify course exists
    course = repo.get_course(db, course_id=course_id)
    if not course:
        raise ValueError("Course not found")
    
    # Validate that all items belong to the course
    item_ids = [item["id"] for item in item_orders]
    existing_items = repo.get_content_items_by_ids(db, item_ids=item_ids, course_id=course_id)
    
    if len(existing_items) != len(item_ids):
        raise ValueError("Some content items not found or don't belong to this course")
    
    success = repo.reorder_content_items(db, course_id=course_id, item_orders=item_orders)
    if not success:
        raise ValueError("Failed to reorder content items")
    
    return {"reordered": True}


# ---------------------- DEADLINE MANAGEMENT ----------------------

def set_course_deadline(db: Session, *, course_id: int, deadline_weeks: Optional[int]):
    """
    Set or update the deadline for a course.
    
    Args:
        course_id: ID of the course
        deadline_weeks: Number of weeks for deadline, or None to remove deadline
    
    Returns:
        Updated course data
    """
    # Validate deadline_weeks if provided
    if deadline_weeks is not None:
        if deadline_weeks <= 0:
            raise ValueError("Deadline must be at least 1 week")
        if deadline_weeks > 10:
            raise ValueError("Deadline cannot exceed 10 weeks")
    
    course = repo.set_course_deadline(db, course_id=course_id, deadline_weeks=deadline_weeks)
    if not course:
        raise ValueError("Course not found")
    
    return {"course": repo.course_to_dict(course)}


def remove_course_deadline(db: Session, *, course_id: int):
    """
    Remove the deadline from a course.
    
    Args:
        course_id: ID of the course
    
    Returns:
        Updated course data
    """
    return set_course_deadline(db, course_id=course_id, deadline_weeks=None)