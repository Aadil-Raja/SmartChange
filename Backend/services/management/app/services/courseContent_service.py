from sqlalchemy.orm import Session
from shared.schemas.training_admin import CourseCreateIn, CourseUpdateIn, ContentItemCreateIn, ContentItemUpdateIn
from app.repositories import courseContent_repo as repo
from app.services.storage.storage_cloudinary import upload_raw_bytes

def _validate_content_payload(body: ContentItemCreateIn | ContentItemUpdateIn, type_str: str, creating=True):
    """Validate content payload based on type and operation."""
    if type_str == "document":
        if creating and not body.document_id:
            raise ValueError("document_id is required for type=document")
    elif type_str == "video":
        if creating and not body.storage_url:
            raise ValueError("storage_url is required for type=video")
    elif type_str == "link":
        if creating and not body.external_url:
            raise ValueError("external_url is required for type=link")
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
        "video": {"storage_url"},
        "link": {"external_url"}
    }
    
    allowed_fields = type_field_map.get(type_str, set())
    all_type_fields = {"document_id", "storage_url", "external_url"}
    
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


def list_courses(db: Session):
    rows = repo.list_courses(db)
    return {"courses": [repo.course_to_dict(c) for c in rows]}


def get_course_with_items(db: Session, *, course_id: int):
    course = repo.get_course(db, course_id=course_id)
    if not course:
        raise ValueError("Course not found")
    items = repo.list_items_for_course(db, course_id=course_id)
    return {
        "course": repo.course_to_dict(course),
        "items": [repo.item_to_dict(i) for i in items],
    }


def set_course_thumbnail(db: Session, *, course_id: int, file_bytes: bytes):
    # Check if course exists first
    course = repo.get_course(db, course_id=course_id)
    if not course:
        raise ValueError("Course not found")
    
    result = upload_raw_bytes(file_bytes)
    url = result.get("secure_url")
    if not url:
        raise ValueError("Failed to upload thumbnail")
    
    course = repo.set_course_thumbnail(db, course_id=course_id, url=url)
    return {"course": repo.course_to_dict(course)}


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
        document_id=body.document_id,
        storage_url=str(body.storage_url) if body.storage_url else None,
        external_url=str(body.external_url) if body.external_url else None,
    )
    return {"item": repo.item_to_dict(item)}


def update_content_item(db: Session, *, content_id: int, body: ContentItemUpdateIn):
    item = repo.get_content_item(db, content_id=content_id)
    if not item:
        raise ValueError("Content item not found")

    # Get current type
    type_str = item.type.value if hasattr(item.type, "value") else str(item.type)
    
    # Convert URL fields to strings
    values = {
        k: (str(v) if "url" in k and v is not None else v)
        for k, v in body.model_dump(exclude_unset=True).items()
    }
    
    if not values:
        raise ValueError("No fields to update")

    # ✅ NEW: Validate that only appropriate fields are being updated
    _validate_type_specific_fields(values, type_str)

    # Validate the merged state to ensure type requirements are still met
    after_doc = values.get("document_id", item.document_id)
    after_store = values.get("storage_url", item.storage_url)
    after_ext = values.get("external_url", item.external_url)
    
    # Create validation object with merged state
    validation_obj = ContentItemCreateIn(
        title=item.title,
        description=item.description,
        type=type_str,
        document_id=after_doc,
        storage_url=after_store,
        external_url=after_ext
    )
    _validate_content_payload(validation_obj, type_str, creating=True)

    updated = repo.update_content_item(db, content_id=content_id, values=values)
    return {"item": repo.item_to_dict(updated)}


def delete_content_item(db: Session, *, content_id: int):
    ok = repo.delete_content_item(db, content_id=content_id)
    if not ok:
        raise ValueError("Content item not found")
    return {"deleted": True}