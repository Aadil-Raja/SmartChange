# ============================================================================
# FILE: app/routers/admin_training.py
# ============================================================================
from fastapi import APIRouter, Depends, UploadFile, File, status, HTTPException,Form
from sqlalchemy.orm import Session
from app.deps.db import get_db

from app.deps.auth import get_current_admin
from app.services import external_link_service as link_svc
from app.services import video_service as vsvc
from app.utils.response_utils import make_response
from shared.schemas.training_admin import (
    CourseCreateIn, CourseUpdateIn,
    ContentItemCreateIn, ContentItemUpdateIn, ContentItemReorderIn, LinkCreate,VideoCreate, LinkUpdate,
    CourseDeadlineUpdate
)
from app.services import courseContent_service as svc

router = APIRouter()

# --------------------------- COURSES ---------------------------

@router.get("/courses", status_code=status.HTTP_200_OK)
def list_courses(db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        return make_response(True, "OK", data=svc.list_courses(db))
    except Exception as e:
        return make_response(False, "Failed to retrieve courses", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.post("/courses", status_code=status.HTTP_201_CREATED)
def create_course(body: CourseCreateIn, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        return make_response(True, "Course created", data=svc.create_course(db, admin_id=_admin.id, body=body))
    except ValueError as e:
        return make_response(False, "Invalid course data provided", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to create course", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.patch("/courses/{course_id}", status_code=status.HTTP_200_OK)
def update_course(course_id: int, body: CourseUpdateIn, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        # Allow is_active toggle (publish/unpublish) even when published
        # Block all other field edits when published
        non_status_fields = {k: v for k, v in body.model_dump(exclude_unset=True).items() if k != "is_active"}
        if non_status_fields:
            _assert_course_is_draft(db, course_id)
        return make_response(True, "Course updated", data=svc.update_course(db, course_id=course_id, body=body))
    except ValueError as e:
        if "published" in str(e).lower():
            return make_response(False, str(e), status_code=status.HTTP_409_CONFLICT, error=str(e))
        if "not found" in str(e).lower():
            return make_response(False, "Course not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
        return make_response(False, "Invalid course data provided", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to update course", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.post("/courses/{course_id}/thumbnail", status_code=status.HTTP_200_OK)
async def set_course_thumbnail(course_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        data = await file.read()
        if not data:
            raise ValueError("Empty file")
        return make_response(True, "Thumbnail updated", data=svc.set_course_thumbnail(db, course_id=course_id, file_bytes=data))
    except ValueError as e:
        return make_response(False, "Invalid thumbnail file", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to update thumbnail", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.get("/courses/{course_id}", status_code=status.HTTP_200_OK)
def get_course_detail(course_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        # Admin sees all content including unpublished quizzes
        return make_response(True, "OK", data=svc.get_course_with_items(db, course_id=course_id, published_only=False, user_role="admin", user_id=_admin.id))
    except ValueError as e:
        return make_response(False, "Course not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to retrieve course details", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))

@router.patch("/courses/{course_id}/deactivate", status_code=status.HTTP_200_OK)
def deactivate_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Mark a course as inactive (soft hide from employees).
    """
    try:
        data = svc.deactivate_course(db, course_id=course_id)
        return make_response(True, "Course marked as inactive", data=data)
    except ValueError as e:
        return make_response(False, "Course not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to deactivate course", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.patch("/courses/{course_id}/activate", status_code=status.HTTP_200_OK)
def activate_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Re-activate a course (make visible to employees again).
    """
    try:
        data = svc.activate_course(db, course_id=course_id)
        return make_response(True, "Course activated", data=data)
    except ValueError as e:
        return make_response(False, "Course not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to activate course", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.delete("/courses/{course_id}", status_code=status.HTTP_200_OK)
def delete_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Permanently delete a course (and its content items if cascade is enabled).
    """
    try:
        data = svc.delete_course(db, course_id=course_id)
        return make_response(True, "Course deleted successfully", data=data)
    except ValueError as e:
        return make_response(False, "Course not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to delete course", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))

@router.delete("/courses/{course_id}/thumbnail", status_code=status.HTTP_200_OK)
def delete_course_thumbnail_route(
    course_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Delete the course thumbnail from Cloudinary and clear its record in DB.
    """
    try:
        return make_response(True, "Thumbnail deleted", data=svc.delete_thumbnail(db, course_id=course_id))
    except ValueError as e:
        return make_response(False, str(e), status_code=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return make_response(False, "Failed to delete thumbnail", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.patch("/courses/{course_id}/deadline", status_code=status.HTTP_200_OK)
def set_course_deadline_route(
    course_id: int,
    body: CourseDeadlineUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Set or update the deadline for a course.
    
    Args:
        course_id: ID of the course
        body: CourseDeadlineUpdate with deadline_weeks (or null to remove)
    
    Returns:
        Updated course with deadline information
    """
    try:
        _assert_course_is_draft(db, course_id)
        return make_response(
            True,
            "Deadline updated" if body.deadline_weeks else "Deadline removed",
            data=svc.set_course_deadline(db, course_id=course_id, deadline_weeks=body.deadline_weeks)
        )
    except ValueError as e:
        if "published" in str(e).lower():
            return make_response(False, str(e), status_code=status.HTTP_409_CONFLICT, error=str(e))
        if "not found" in str(e).lower():
            return make_response(False, "Course not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
        return make_response(False, "Invalid deadline value", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to update deadline", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


# --------------------------- CONTENT ITEMS ---------------------------

def _assert_course_is_draft(db: Session, course_id: int):
    """Raise ValueError if course is published (active). Used to guard edit endpoints."""
    from shared.models.course import Course
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise ValueError("Course not found")
    if course.is_active:
        raise ValueError("Course is published. Unpublish it before making changes.")


@router.post("/courses/{course_id}/content", status_code=status.HTTP_201_CREATED)
def add_content_item(course_id: int, body: ContentItemCreateIn, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        _assert_course_is_draft(db, course_id)
        return make_response(True, "Content added", data=svc.add_content_item(db, course_id=course_id, body=body))
    except ValueError as e:
        code = status.HTTP_409_CONFLICT if "published" in str(e).lower() else status.HTTP_400_BAD_REQUEST
        return make_response(False, str(e), status_code=code, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to add content", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.patch("/content/{content_id}", status_code=status.HTTP_200_OK)
def update_content_item(content_id: int, body: ContentItemUpdateIn, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        from shared.models.course_content import ContentItem
        item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
        if item:
            _assert_course_is_draft(db, item.course_id)
        return make_response(True, "Content updated", data=svc.update_content_item(db, content_id=content_id, body=body))
    except ValueError as e:
        if "not found" in str(e).lower():
            return make_response(False, "Content not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
        code = status.HTTP_409_CONFLICT if "published" in str(e).lower() else status.HTTP_400_BAD_REQUEST
        return make_response(False, str(e), status_code=code, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to update content", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.delete("/content/{content_id}", status_code=status.HTTP_200_OK)
def delete_content_item(content_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        from shared.models.course_content import ContentItem
        item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
        if item:
            _assert_course_is_draft(db, item.course_id)
        return make_response(True, "Content deleted", data=svc.delete_content_item(db, content_id=content_id))
    except ValueError as e:
        code = status.HTTP_409_CONFLICT if "published" in str(e).lower() else status.HTTP_404_NOT_FOUND
        return make_response(False, str(e), status_code=code, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to delete content", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.patch("/courses/{course_id}/content/reorder", status_code=status.HTTP_200_OK)
def reorder_content_items(
    course_id: int,
    body: ContentItemReorderIn,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin)
):
    try:
        _assert_course_is_draft(db, course_id)
        return make_response(
            True,
            "Content items reordered",
            data=svc.reorder_content_items(db, course_id=course_id, item_orders=body.items)
        )
    except ValueError as e:
        if "published" in str(e).lower():
            return make_response(False, str(e), status_code=status.HTTP_409_CONFLICT, error=str(e))
        if "not found" in str(e).lower():
            return make_response(False, "Course or content items not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
        return make_response(False, "Invalid reorder data", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to reorder content", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))
    

@router.post("/links", status_code=status.HTTP_201_CREATED)
def create_external_link(
    body: LinkCreate,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    try:
        data = link_svc.create_link(db, admin_id=_admin.id, body=body)
        return make_response(True, "External link added", data=data)
    except ValueError as e:
        return make_response(False, "Invalid link data provided", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to create external link", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))

@router.get("/links", status_code=status.HTTP_200_OK)
def list_links(db: Session = Depends(get_db), _admin = Depends(get_current_admin)):
    try:
        return make_response(True, "OK", data=link_svc.list_links(db))
    except Exception as e:
        return make_response(False, "Failed to retrieve links", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))

@router.get("/links/{link_id}", status_code=status.HTTP_200_OK)
def get_external_link(
    link_id: int,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    try:
        return make_response(True, "OK", data=link_svc.get_link_by_id(db, link_id=link_id))
    except ValueError as e:
        return make_response(False, "Link not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to retrieve link", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))

@router.patch("/links/{link_id}", status_code=status.HTTP_200_OK)
def update_external_link(
    link_id: int,
    body: LinkUpdate,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    """
    Update an external link's title and/or URL.
    """
    try:
        data = link_svc.update_link(db, link_id=link_id, body=body)
        return make_response(True, "External link updated", data=data)
    except ValueError as e:
        if "not found" in str(e).lower():
            return make_response(False, "Link not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
        return make_response(False, "Invalid link data provided", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to update external link", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))

@router.delete("/links/{link_id}", status_code=status.HTTP_200_OK)
def delete_external_link(
    link_id: int,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    """
    Delete an external link. Blocked if referenced by any course content item.
    """
    try:
        data = link_svc.delete_link(db, link_id=link_id)
        return make_response(True, "External link deleted", data=data)
    except ValueError as e:
        msg = str(e)
        code = status.HTTP_409_CONFLICT if "Cannot delete" in msg else status.HTTP_404_NOT_FOUND
        return make_response(False, msg, status_code=code, error=msg)
    except Exception as e:
        return make_response(False, "Failed to delete external link", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.post("/videos", status_code=status.HTTP_201_CREATED)
async def upload_video_route(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    """
    Upload a new lecture/MP4 to Cloudinary and store in the videos library.
    """
    try:
        data = await file.read()
        if not data:
            return make_response(False, "Empty file", status_code=status.HTTP_400_BAD_REQUEST)
        
        out = vsvc.upload_video(
            db,
            admin_id=_admin.id,
            file_bytes=data,
            filename=file.filename,
            title=title,
            mime=file.content_type,
        )
        return make_response(True, "Video uploaded", data=out)
    except ValueError as e:
        return make_response(False, "Invalid video", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to upload video", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))
    
@router.get("/videos", status_code=status.HTTP_200_OK)
def list_videos_route(
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    """
    List videos in the reusable library (pick one to attach to a course content item).
    """
    try:
        return make_response(True, "OK", data=vsvc.list_videos(db))
    except Exception as e:
        return make_response(False, "Failed to list videos", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.get("/videos/{video_id}", status_code=status.HTTP_200_OK)
def get_video_route(
    video_id: int,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    """
    Get a single video by ID.
    """
    try:
        return make_response(True, "OK", data=vsvc.get_video_by_id(db, video_id=video_id))
    except ValueError as e:
        return make_response(False, "Video not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to retrieve video", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.delete("/videos/{video_id}", status_code=status.HTTP_200_OK)
def delete_video_route(
    video_id: int,
    db: Session = Depends(get_db),
    _admin = Depends(get_current_admin),
):
    """
    Delete a video. Blocked if referenced by any course content item.
    """
    try:
        return make_response(True, "Video deleted", data=vsvc.delete_video(db, video_id=video_id))
    except ValueError as e:
        msg = str(e)
        code = status.HTTP_409_CONFLICT if "Cannot delete" in msg else status.HTTP_404_NOT_FOUND
        return make_response(False, msg, status_code=code, error=msg)
    except Exception as e:
        return make_response(False, "Failed to delete video", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))
