# ============================================================================
# FILE: app/routers/admin_training.py
# ============================================================================
from fastapi import APIRouter, Depends, UploadFile, File, status, HTTPException
from sqlalchemy.orm import Session
from app.deps.db import get_db
from app.deps.auth import get_current_admin
from app.utils.response_utils import make_response
from shared.schemas.training_admin import (
    CourseCreateIn, CourseUpdateIn,
    ContentItemCreateIn, ContentItemUpdateIn
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
        return make_response(True, "Course updated", data=svc.update_course(db, course_id=course_id, body=body))
    except ValueError as e:
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
        return make_response(True, "OK", data=svc.get_course_with_items(db, course_id=course_id))
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




# --------------------------- CONTENT ITEMS ---------------------------

@router.post("/courses/{course_id}/content", status_code=status.HTTP_201_CREATED)
def add_content_item(course_id: int, body: ContentItemCreateIn, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        return make_response(True, "Content added", data=svc.add_content_item(db, course_id=course_id, body=body))
    except ValueError as e:
        return make_response(False, "Invalid content data provided", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to add content", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.patch("/content/{content_id}", status_code=status.HTTP_200_OK)
def update_content_item(content_id: int, body: ContentItemUpdateIn, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        return make_response(True, "Content updated", data=svc.update_content_item(db, content_id=content_id, body=body))
    except ValueError as e:
        if "not found" in str(e).lower():
            return make_response(False, "Content not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
        return make_response(False, "Invalid content data provided", status_code=status.HTTP_400_BAD_REQUEST, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to update content", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))


@router.delete("/content/{content_id}", status_code=status.HTTP_200_OK)
def delete_content_item(content_id: int, db: Session = Depends(get_db), _admin=Depends(get_current_admin)):
    try:
        return make_response(True, "Content deleted", data=svc.delete_content_item(db, content_id=content_id))
    except ValueError as e:
        return make_response(False, "Content not found", status_code=status.HTTP_404_NOT_FOUND, error=str(e))
    except Exception as e:
        return make_response(False, "Failed to delete content", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, error=str(e))