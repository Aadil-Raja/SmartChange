from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.services import employee_service
from app.utils.response_utils import make_response
import shared.schemas as schemas
from typing import Optional, Dict, Any, List
from shared.repos import documents_repo
from app.services import courseContent_service as svc
from shared.schemas.progress import ProgressUpdateIn
router = APIRouter()

# ---------------------------
# My Teams
# ---------------------------
@router.get("/my-teams", status_code=status.HTTP_200_OK)
def my_teams_route(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Return teams the logged-in user is part of.
    If the user is a manager, include the join_code.
    """
    try:
        return employee_service.get_my_teams(db, user)
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


# ---------------------------
# Join Team with Code
# ---------------------------
@router.post("/join", status_code=status.HTTP_200_OK)
def join_team_with_code_route(
    payload: schemas.JoinCodeIn,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Join a team using a 6-digit code.
    """
    try:
        return employee_service.join_with_code(db, user_id=current_user.id, code=payload.code)
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)



@router.post("/{team_id}/regenerate-code", status_code=status.HTTP_200_OK)
def regenerate_team_code_route(
    team_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Regenerate the 6-digit join code (only if caller is a manager of this team)."""
    try:
        return employee_service.regenerate_team_code(db, user_id=current_user.id, team_id=team_id)
    except Exception:
        return make_response(False, "Unexpected server error", status_code=500)


# ---------------------------
# Training Courses and Content
# ---------------------------
def _item_url(db: Session, item: Dict[str, Any]) -> Optional[str]:
    """
    Decide which URL to expose to employees, using documents_repo for documents.
    - document  -> doc.cloudinary_url (via repo)
    - video     -> storage_url
    - link      -> external_url
    """
    t = item.get("type")
    if t == "document":
        doc_id = item.get("document_id")
        if doc_id:
            doc = documents_repo.get_document(db, document_id=doc_id)
            return getattr(doc, "cloudinary_url", None) if doc else None
        return None
    if t == "video":
        return item.get("storage_url")
    if t == "link":
        return item.get("external_url")
    return None


def _shape_employee_item(db: Session, item: Dict[str, Any]) -> Dict[str, Any]:
    """Return the minimal, FE-friendly shape for an employee content item."""
    return {
        "id": item["id"],
        "course_id": item["course_id"],
        "title": item["title"],
        "description": item.get("description"),
        "type": item["type"],
        "url": _item_url(db, item),           # unified link the FE can open
        "document_id": item.get("document_id")  # optional: keep for telemetry/future
    }


@router.get("/courses", status_code=status.HTTP_200_OK)
def list_courses_route(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    List all *active* courses visible to employees.
    Reuses courseContent_service.list_courses, then filters to is_active==True.
    """
    try:
        data = svc.list_courses(db)  # { "courses": [ { ... } ] }
        # keep only active for employees
        courses = [c for c in data.get("courses", []) if c.get("is_active")]
        return make_response(True, "OK", data={"courses": courses})
    except Exception as e:
        return make_response(False, str(e), status_code=500)


@router.get("/courses/{course_id}", status_code=status.HTTP_200_OK)
def get_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get a single active course and its items.
    Items include a single 'url' field:
      - document  -> document.cloudinary_url (via documents_repo)
      - video     -> storage_url
      - link      -> external_url
    """
    try:
        data = svc.get_course_with_items(db, course_id=course_id)  # { "course": {...}, "items": [...] }
        course = data.get("course")
        if not course or not course.get("is_active"):
            return make_response(False, "Course not found", status_code=404)

        items_raw: List[Dict[str, Any]] = data.get("items", [])
        items = [_shape_employee_item(db, it) for it in items_raw]

        return make_response(True, "OK", data={"course": course, "items": items})
    except Exception as e:
        return make_response(False, str(e), status_code=500)
    


@router.get("/documents/processed", status_code=status.HTTP_200_OK)
def list_processed_documents_route(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Return all documents with status = PROCESSED,
    including id, title, original_filename, mime_type, size, created_at, cloudinary_url, etc.
    """
    try:
        data = documents_repo.list_processed_documents(db)
        return make_response(True, "OK", data=data)
    except Exception as e:
        return make_response(False, str(e), status_code=500)
    



@router.post("/content/{content_id}/progress", status_code=status.HTTP_200_OK)
def mark_or_update_progress_route(
    content_id: int,
    payload: ProgressUpdateIn,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Mark/update progress for a single content item.
    - For docs/links, send { completed: true } to mark complete.
    - For videos, send { progress: <0..100> } as it plays; sending 100 or completed=true marks complete.
    Idempotent and monotonic (never decreases progress).
    """
    try:
        data = employee_service.update_progress(
            db,
            user_id=user.id,
            content_id=content_id,
            progress=payload.progress,
            completed=payload.completed,
        )
        return make_response(True, "Progress updated", data=data)
    except Exception as e:
        return make_response(False, str(e), status_code=500)


@router.get("/courses/{course_id}/progress", status_code=status.HTTP_200_OK)
def get_course_progress_route(
    course_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Compute course progress for the current user:
    completed_items / total_items (in %).
    """
    try:
        data = employee_service.course_progress(db, user_id=user.id, course_id=course_id)
        return make_response(True, "OK", data=data)
    except Exception as e:
        return make_response(False, str(e), status_code=500)