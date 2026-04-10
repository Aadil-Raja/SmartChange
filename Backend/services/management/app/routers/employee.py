from fastapi import APIRouter, Depends, status, UploadFile, File
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
from shared.schemas.employee_quiz import QuizAttemptSubmission
from app.services import employee_quiz_service

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
        return make_response(False, "Could not fetch your teams", status_code=500, error=str(e))


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
        return make_response(False, "Could not join team", status_code=500, error=str(e))


@router.post("/{team_id}/regenerate-code", status_code=status.HTTP_200_OK)
def regenerate_team_code_route(
    team_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Regenerate the 6-digit join code (only if caller is a manager of this team)."""
    try:
        return employee_service.regenerate_team_code(db, user_id=current_user.id, team_id=team_id)
    except Exception as e:
        return make_response(False, "Could not regenerate team code", status_code=500, error=str(e))


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
    List all *active* courses visible to employees with enrollment status and progress.
    
    Returns:
    - Basic course info (title, description, thumbnail, etc.)
    - Enrollment status (category, enrolled_at, deadline_at, can_interact)
    - Progress data (only for enrolled courses)
    - Starred status
    
    Categories:
    - "not_enrolled": User hasn't enrolled yet
    - "in_progress": User is enrolled and course is active
    - "completed": User completed the course
    - "expired": User enrolled but deadline has passed
    """
    try:
        data = employee_service.get_courses_with_enrollment(db, user_id=user.id)
        return make_response(True, "OK", data=data)
    except Exception as e:
        return make_response(False, "Could not fetch courses", status_code=500, error=str(e))


@router.get("/courses/{course_id}", status_code=status.HTTP_200_OK)
def get_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Fast endpoint — returns course info, content items, and progress.
    Quizzes with unlock status are fetched separately via /courses/{id}/quizzes.
    """
    try:
        course = svc.repo.get_course(db, course_id=course_id)
        if not course or not course.is_active:
            return make_response(False, "Course not found", status_code=404)

        items = svc.repo.list_items_for_course(db, course_id=course_id)

        from app.repositories.course_enrollment_repo import get_enrollment, get_enrollment_status
        enrollment = get_enrollment(db, user_id=user.id, course_id=course_id)

        course_dict = svc.repo.course_to_dict(course)
        course_dict["is_enrolled"] = enrollment is not None
        if enrollment:
            course_dict["enrollment_status"] = get_enrollment_status(enrollment, course)
        else:
            course_dict["enrollment_status"] = "not_enrolled"

        items_progress_data = employee_service.course_items_progress(db, user_id=user.id, course_id=course_id)

        return make_response(True, "OK", data={
            "course": course_dict,
            "items": [svc.repo.item_to_dict(i) for i in items],
            "items_progress": items_progress_data,
        })
    except Exception as e:
        return make_response(False, "Could not fetch course details", status_code=500, error=str(e))


@router.get("/courses/{course_id}/quizzes", status_code=status.HTTP_200_OK)
def get_course_quizzes_route(
    course_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Separate endpoint for quiz status — heavier due to per-quiz unlock/attempt checks.
    Called after the main course page has already rendered.
    """
    try:
        from app.repositories.courseContent_repo import list_quizzes_for_course
        quizzes = list_quizzes_for_course(db, course_id=course_id, user_id=user.id, published_only=True)
        return make_response(True, "OK", data={"quizzes": quizzes})
    except Exception as e:
        return make_response(False, "Could not fetch quizzes", status_code=500, error=str(e))

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
        return make_response(False, "Could not fetch processed documents", status_code=500, error=str(e))


@router.get("/documents/processed/{document_id}", status_code=status.HTTP_200_OK)
def get_processed_document_by_id_route(
    document_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Return one processed document by ID with full metadata.
    Useful for citation click flows where doc_id is known but URL isn't in memory.
    """
    try:
        document = documents_repo.get_processed_document_by_id(db, document_id=document_id)
        if not document:
            return make_response(False, "Document not found", status_code=404)
        return make_response(True, "OK", data={"document": document})
    except Exception as e:
        return make_response(False, "Could not fetch document", status_code=500, error=str(e))


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
        return make_response(False, "Could not update progress", status_code=500, error=str(e))


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
        return make_response(False, "Could not fetch course progress", status_code=500, error=str(e))


@router.get("/courses/{course_id}/progress/items", status_code=status.HTTP_200_OK)
def get_course_items_progress_route(
    course_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Return the current user's progress for each item in a course.
    Shape:
    {
      "course_id": <int>,
      "items": [
        {
          "content_id": <int>,
          "title": "...",
          "type": "document|video|link",
          "progress": 0..100,
          "completed_at": "... or null",
          "last_viewed_at": "... or null"
        },
        ...
      ]
    }
    """
    try:
        data = employee_service.course_items_progress(db, user_id=user.id, course_id=course_id)
        return make_response(True, "OK", data=data)
    except Exception as e:
        return make_response(False, "Could not fetch course items progress", status_code=500, error=str(e))


# ---------------------------
# Starred Courses (Bookmarks)
# ---------------------------
@router.post("/courses/{course_id}/star", status_code=status.HTTP_200_OK)
def star_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Star/bookmark a course for the current user.
    Idempotent - can be called multiple times safely.
    """
    try:
        return employee_service.star_course(db, user_id=user.id, course_id=course_id)
    except Exception as e:
        return make_response(False, "Could not star course", status_code=500, error=str(e))


@router.delete("/courses/{course_id}/star", status_code=status.HTTP_200_OK)
def unstar_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Remove star/bookmark from a course.
    Returns 404 if the course wasn't starred.
    """
    try:
        return employee_service.unstar_course(db, user_id=user.id, course_id=course_id)
    except Exception as e:
        return make_response(False, "Could not unstar course", status_code=500, error=str(e))


@router.get("/courses-starred", status_code=status.HTTP_200_OK)
def get_starred_courses_route(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Get all starred courses for the current user with their progress.
    Returns:
    {
      "starred_courses": [
        {
          "id": 1,
          "title": "...",
          "description": "...",
          "progress": 45.5,
          "completed_items": 5,
          "total_items": 11,
          "is_completed": false
        },
        ...
      ]
    }
    """
    try:
        data = employee_service.get_starred_courses(db, user_id=user.id)
        return make_response(True, "OK", data=data)
    except Exception as e:
        return make_response(False, "Could not fetch starred courses", status_code=500, error=str(e))


# ---------------------------
# Personal Course Overview
# ---------------------------
@router.get("/me/courses/overview", status_code=status.HTTP_200_OK)
def get_my_courses_overview_route(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Get a comprehensive overview of all courses categorized by:
    - Starred: Courses the user has bookmarked
    - In Progress: Courses with 0 < progress < 100
    - Completed: Courses with progress = 100
    
    Each course includes progress data.
    This is ideal for a personal dashboard/profile page.
    
    Returns:
    {
      "starred": [...],
      "in_progress": [...],
      "completed": [...]
    }
    """
    try:
        data = employee_service.get_courses_overview(db, user_id=user.id)
        return make_response(True, "OK", data=data)
    except Exception as e:
        return make_response(False, "Could not fetch courses overview", status_code=500, error=str(e))


# ---------------------------
# Profile Picture Management
# ---------------------------
@router.post("/me/profile-picture", status_code=status.HTTP_200_OK)
async def upload_profile_picture_route(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Upload or update the current user's profile picture.
    Accepts image files (JPG, PNG, etc.).
    If a profile picture already exists, it will be replaced.
    """
    try:
        # Read file bytes
        file_bytes = await file.read()
        if not file_bytes:
            return make_response(False, "Empty file", status_code=400)
        
        # Validate file type (basic check)
        if not file.content_type or not file.content_type.startswith("image/"):
            return make_response(False, "File must be an image", status_code=400)
        
        return employee_service.upload_profile_picture(
            db, user_id=user.id, file_bytes=file_bytes
        )
    except Exception as e:
        return make_response(False, "Could not upload profile picture", status_code=500, error=str(e))


@router.delete("/me/profile-picture", status_code=status.HTTP_200_OK)
def remove_profile_picture_route(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Remove the current user's profile picture.
    """
    try:
        return employee_service.remove_profile_picture(db, user_id=user.id)
    except Exception as e:
        return make_response(False, "Could not remove profile picture", status_code=500, error=str(e))


@router.get("/me/profile", status_code=status.HTTP_200_OK)
def get_my_profile_route(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Get the current user's profile information including profile picture.
    """
    try:
        return employee_service.get_user_profile(db, user_id=user.id)
    except Exception as e:
        return make_response(False, "Could not fetch profile", status_code=500, error=str(e))


# ---------------------------
# Course Enrollment
# ---------------------------
@router.post("/courses/{course_id}/enroll", status_code=status.HTTP_200_OK)
def enroll_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Enroll in a course (Start button functionality).
    Idempotent - returns existing enrollment if already enrolled.
    
    Returns enrollment status with deadline information.
    """
    try:
        return employee_service.enroll_course(db, user_id=user.id, course_id=course_id)
    except Exception as e:
        return make_response(False, "Could not enroll in course", status_code=500, error=str(e))


@router.delete("/courses/{course_id}/enroll", status_code=status.HTTP_200_OK)
def unenroll_course_route(
    course_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Unenroll from a course.
    
    WARNING: This will delete:
    - Enrollment record
    - All progress on course content
    - All quiz attempts for this course
    
    This action cannot be undone.
    """
    try:
        return employee_service.unenroll_course(db, user_id=user.id, course_id=course_id)
    except Exception as e:
        return make_response(False, "Could not unenroll from course", status_code=500, error=str(e))


# ============ QUIZ TAKING ENDPOINTS ============

@router.get("/quizzes/{quiz_id}", status_code=status.HTTP_200_OK)
def get_quiz_for_taking(
    quiz_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Get quiz for employee to take.
    
    Returns quiz questions WITHOUT correct answers or explanations.
    Only works if quiz status is "can_take":
    - Quiz is published
    - Quiz is unlocked (prerequisites met)
    - User has remaining attempts
    - Not in cooldown period
    - Not already completed (unless retakes allowed)
    
    Returns 403 Forbidden for other statuses:
    - "locked": Prerequisites not met or unpublished
    - "completed": Already passed the quiz
    - "in_cooldown": Must wait before next attempt
    - "max_attempts_reached": Used all attempts
    """
    try:
        return employee_quiz_service.get_quiz_for_taking(db, quiz_id=quiz_id, user_id=user.id)
    except Exception as e:
        return make_response(False, "Could not load quiz", status_code=500, error=str(e))


@router.post("/quizzes/{quiz_id}/attempt", status_code=status.HTTP_201_CREATED)
def submit_quiz_attempt(
    quiz_id: int,
    payload: QuizAttemptSubmission,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Submit quiz attempt and get results.
    
    Body: {"answers": {"question_id": selected_option_index}}
    
    Returns detailed results with correct answers and explanations.
    """
    try:
        return employee_quiz_service.submit_quiz_attempt(
            db, 
            quiz_id=quiz_id, 
            user_id=user.id, 
            answers=payload.answers
        )
    except Exception as e:
        return make_response(False, "Could not submit quiz", status_code=500, error=str(e))
