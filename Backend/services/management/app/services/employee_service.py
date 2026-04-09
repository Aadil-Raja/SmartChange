from app.repositories import teams_repo
from app.utils.response_utils import make_response
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from shared.models import Team, TeamMember, TeamMemberRole, User
from app.repositories import progress_repo as prog_repo
from app.repositories import courseContent_repo as content_repo
from app.repositories import course_stars_repo
from app.repositories import course_enrollment_repo as enrollment_repo
from app.services import courseContent_service
from app.services.storage.storage_cloudinary import upload_image_bytes, delete_file_by_public_id
from app.utils.course_progress import calculate_course_progress, build_user_courses_overview
from app.utils.enrollment_utils import determine_category, build_enrollment_based_overview
def get_my_teams(db, user):
    rows = teams_repo.get_teams_for_user(db, user.id)
    data = []

    for team, role in rows:
    
        data.append({
            "team_id": team.id,
            "team_name": team.name,
            "join_code": team.join_code if role.value == "manager" else None,  # ✅ only managers see code
            "role_in_team": role.value,
        
        })

    return make_response(True, "Teams fetched successfully", data=data,status_code=200)


def get_courses_with_enrollment(db: Session, *, user_id: int) -> Dict[str, Any]:
    """
    Get all active courses with enrollment status, progress, and category for a user.
    
    Returns courses with:
    - Basic course info
    - Enrollment status (category, enrolled_at, deadline_at, etc.)
    - Progress data (only for enrolled courses)
    - Starred status
    - can_interact flag
    """
    # Get all active courses
    courses_data = courseContent_service.list_courses(db, active_only=True)
    all_courses = courses_data.get("courses", [])
    
    # Get starred course IDs
    starred_ids = set(course_stars_repo.list_starred_course_ids(db, user_id=user_id))
    
    result = []
    
    for course in all_courses:
        course_id = course["id"]
        
        # Get enrollment status
        enrollment_status = enrollment_repo.get_enrollment_with_status(
            db, user_id=user_id, course_id=course_id
        )

        # Self-heal: if marked completed but new content was added since, reopen
        if enrollment_status["completed_at"] and enrollment_status["is_enrolled"]:
            from shared.models.course_content import ContentItem
            from app.repositories import progress_repo as _prog_repo
            content_ids = [i.id for i in db.query(ContentItem).filter(ContentItem.course_id == course_id).all()]
            if content_ids:
                rows = _prog_repo.list_for_user_and_content_ids(db, user_id=user_id, content_ids=content_ids)
                done_ids = {r.content_id for r in rows if r.completed_at is not None or (r.progress or 0) >= 100.0}
                if not (done_ids >= set(content_ids)):
                    enrollment = enrollment_repo.get_enrollment(db, user_id=user_id, course_id=course_id)
                    if enrollment:
                        enrollment.completed_at = None
                        db.commit()
                        # Refresh enrollment_status
                        enrollment_status = enrollment_repo.get_enrollment_with_status(
                            db, user_id=user_id, course_id=course_id
                        )

        # Determine category based on enrollment status
        category = _determine_category(enrollment_status)
        
        # Calculate progress only for enrolled courses
        progress_data = None
        if enrollment_status["is_enrolled"]:
            progress_calc = calculate_course_progress(db, user_id=user_id, course_id=course_id)
            progress_data = {
                "completed_items": progress_calc["completed_items"],
                "total_items": progress_calc["total_items"],
                "completed_quizzes": progress_calc["completed_quizzes"],
                "total_quizzes": progress_calc["total_quizzes"],
                "percent": progress_calc["percent"]
            }
        
        # Build course response
        course_info = {
            "id": course_id,
            "title": course["title"],
            "description": course.get("description"),
            "department": course.get("department"),
            "thumbnail_url": course.get("thumbnail_url"),
            "deadline_weeks": course.get("deadline_weeks"),
            "created_at": course.get("created_at"),
            
            # Enrollment info
            "category": category,
            "enrolled_at": enrollment_status["enrolled_at"],
            "completed_at": enrollment_status["completed_at"],
            "deadline_at": enrollment_status["deadline_at"],
            "days_remaining": enrollment_status["days_remaining"],
            "can_interact": enrollment_status["can_interact"],
            
            # Progress (null if not enrolled)
            "progress": progress_data,
            
            # Starred status
            "is_starred": course_id in starred_ids
        }
        
        result.append(course_info)
    
    return {"courses": result}


def _determine_category(enrollment_status: Dict[str, Any]) -> str:
    """
    Determine course category based on enrollment status.
    
    Categories:
    - "not_enrolled": User hasn't enrolled
    - "expired": Enrolled but deadline passed (and not completed)
    - "completed": Enrolled and completed
    - "in_progress": Enrolled and active (includes 0% progress)
    """
    if not enrollment_status["is_enrolled"]:
        return "not_enrolled"
    
    status = enrollment_status["status"]
    
    if status == "completed":
        return "completed"
    elif status == "expired":
        return "expired"
    else:  # status == "active"
        return "in_progress"

def join_with_code(db: Session, *, user_id: int, code: str):
    """Allow a user to join a team using its unique join code."""
    code = code.strip()

    team = db.query(Team).filter(Team.join_code == code).first()
    if not team:
        return make_response(False, "Invalid or expired team code", status_code=400)

    existing = db.query(TeamMember).filter_by(team_id=team.id, user_id=user_id).first()
    if existing:
        return make_response(False, "Already a member of this team", data={
            "team_id": team.id, "team_name": team.name, "role_in_team": existing.role_in_team.value
        }, status_code=200)

    tm = TeamMember(team_id=team.id, user_id=user_id, role_in_team=TeamMemberRole.member)
    db.add(tm)
    db.commit()
    db.refresh(tm)

    return make_response(True, "Joined team successfully", data={
        "team_id": team.id,
        "team_name": team.name,
        "role_in_team": tm.role_in_team.value
    }, status_code=200)




def regenerate_team_code(db: Session, *, user_id: int, team_id: int):
    """Only a manager of the team can regenerate its join code."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        return make_response(False, "Team not found", status_code=404)

    membership = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        .first()
    )
    if not membership or membership.role_in_team != TeamMemberRole.manager:
        return make_response(False, "Only team managers can regenerate codes", status_code=403)

    # ✅ Use the repo’s helper
    team.join_code = teams_repo._generate_unique_code(db)
    db.commit()
    db.refresh(team)

    return make_response(True, "Join code regenerated successfully", data={
        "team_id": team.id,
        "team_name": team.name,
        "join_code": team.join_code
    }, status_code=200)


def update_progress(
    db: Session,
    *,
    user_id: int,
    content_id: int,
    progress: float,
    completed: bool | None,
) -> Dict[str, Any]:
    # Check enrollment — must be enrolled to track progress
    from shared.models.course_content import ContentItem
    from app.repositories.course_enrollment_repo import get_enrollment
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if item:
        enrollment = get_enrollment(db, user_id=user_id, course_id=item.course_id)
        if not enrollment:
            raise ValueError("You must be enrolled in this course to track progress")

    mark_complete = bool(completed) or progress >= 100.0
    row = prog_repo.upsert_progress(
        db,
        user_id=user_id,
        content_id=content_id,
        progress=progress,
        mark_complete=mark_complete,
    )

    # Auto-complete course if all content done AND all quizzes passed or exhausted
    if mark_complete and item:
        try:
            from app.repositories.course_enrollment_repo import get_enrollment, mark_course_completed
            from shared.repos.course_quiz_repo import get_course_quizzes_by_course
            from shared.models.course_quiz import QuizStatus as CQStatus
            from shared.services.quiz_status_service import calculate_quiz_status

            enrollment = get_enrollment(db, user_id=user_id, course_id=item.course_id)
            if enrollment and not enrollment.completed_at:
                items = db.query(ContentItem).filter(ContentItem.course_id == item.course_id).all()
                content_ids = [i.id for i in items]
                rows = prog_repo.list_for_user_and_content_ids(db, user_id=user_id, content_ids=content_ids)
                done_ids = {r.content_id for r in rows if r.completed_at is not None or (r.progress or 0) >= 100.0}
                all_content_done = done_ids >= set(content_ids)

                published_quizzes = get_course_quizzes_by_course(db, item.course_id, CQStatus.PUBLISHED)
                all_quizzes_done = all(
                    calculate_quiz_status(db, user_id, q)["status"] in ("completed", "max_attempts_reached")
                    for q in published_quizzes
                ) if published_quizzes else True

                if all_content_done and all_quizzes_done:
                    mark_course_completed(db, user_id=user_id, course_id=item.course_id)
        except Exception:
            pass
    return {
        "content_id": row.content_id,
        "progress": float(row.progress),
        "completed_at": row.completed_at,
        "last_viewed_at": row.last_viewed_at,
    }


def course_progress(
    db: Session,
    *,
    user_id: int,
    course_id: int,
) -> Dict[str, Any]:
    """Get course progress for a user (wrapper around shared utility)"""
    return calculate_course_progress(db, user_id=user_id, course_id=course_id)

def course_items_progress(
    db: Session,
    *,
    user_id: int,
    course_id: int,
) -> Dict[str, Any]:
    # All items in the course
    items = content_repo.list_items_for_course(db, course_id=course_id)
    content_ids: List[int] = [it.id for it in items]

    # If no items, return empty list
    if not content_ids:
        return {"course_id": course_id, "items": []}

    # Get progress rows for this user across these items
    rows = prog_repo.list_for_user_and_content_ids(
        db, user_id=user_id, content_ids=content_ids
    )
    by_id = {r.content_id: r for r in rows}

    # Build per-item progress (default 0 if no row yet)
    result = []
    for it in items:
        r = by_id.get(it.id)
        t = it.type.value if hasattr(it.type, "value") else str(it.type)
        result.append({
            "content_id": it.id,
            "title": it.title,
            "type": t,
            "progress": float(r.progress) if r else 0.0,
            "completed_at": r.completed_at if r else None,
            "last_viewed_at": r.last_viewed_at if r else None,
        })

    return {"course_id": course_id, "items": result}




def star_course(db: Session, *, user_id: int, course_id: int) -> Dict[str, Any]:
    """Star/bookmark a course"""
    # Verify course exists and is active
    course = content_repo.get_course(db, course_id=course_id)
    if not course:
        return make_response(False, "Course not found", status_code=404)
    
    if not course.is_active:
        return make_response(False, "Cannot star inactive course", status_code=400)
    
    # Star it (idempotent)
    star = course_stars_repo.star_course(db, user_id=user_id, course_id=course_id)
    
    return make_response(True, "Course starred successfully", data={
        "course_id": course_id,
        "starred_at": star.starred_at
    }, status_code=200)


def unstar_course(db: Session, *, user_id: int, course_id: int) -> Dict[str, Any]:
    """Remove star/bookmark from a course"""
    deleted = course_stars_repo.unstar_course(db, user_id=user_id, course_id=course_id)
    
    if not deleted:
        return make_response(False, "Course was not starred", status_code=404)
    
    return make_response(True, "Course unstarred successfully", data={
        "course_id": course_id
    }, status_code=200)


def get_starred_courses(db: Session, *, user_id: int) -> Dict[str, Any]:
    """Get all starred courses with their progress"""
    starred_course_ids = course_stars_repo.list_starred_course_ids(db, user_id=user_id)
    
    if not starred_course_ids:
        return {"starred_courses": []}
    
    # Get course details
    courses = content_repo.list_courses_by_ids(db, course_ids=starred_course_ids)
    
    # Calculate progress for each
    result = []
    for course in courses:
        if not course.get("is_active"):
            continue  # Skip inactive courses
        
        progress_data = calculate_course_progress(db, user_id=user_id, course_id=course["id"])
        
        result.append({
            "id": course["id"],
            "title": course["title"],
            "description": course.get("description"),
            "progress": progress_data["percent"],
            "completed_items": progress_data["completed_items"],
            "total_items": progress_data["total_items"],
            "completed_quizzes": progress_data["completed_quizzes"],
            "total_quizzes": progress_data["total_quizzes"],
            "is_completed": progress_data["percent"] >= 100.0,
            "department": course.get("department"),
            "thumbnail_url": course.get("thumbnail_url"),
        })
    
    return {"starred_courses": result}


def get_courses_overview(db: Session, *, user_id: int) -> Dict[str, Any]:
    """
    Get comprehensive overview of user's courses categorized by enrollment status.
    
    Returns:
    - Starred courses (can include non-enrolled)
    - In Progress courses (enrolled, active, not completed)
    - Completed courses (enrolled, completed)
    - Expired courses (enrolled, deadline passed)
    - Statistics based on enrollment
    """
    # Get user information
    user = db.query(User).filter(User.id == user_id).first()
    user_name = user.Name if user else None
    
    # Get starred course IDs
    starred_ids = set(course_stars_repo.list_starred_course_ids(db, user_id=user_id))
    
    # Build overview using shared utility
    overview = build_enrollment_based_overview(
        db,
        user_id=user_id,
        include_starred=True,
        starred_ids=starred_ids
    )
    
    return {
        "user_name": user_name,
        "profile_picture_url": user.profile_picture_url if user else None,
        "stats": overview["stats"],
        "starred": overview["starred"],
        "in_progress": overview["in_progress"],
        "completed": overview["completed"],
        "expired": overview["expired"],
    }


def _determine_category(enrollment_status: Dict[str, Any]) -> str:
    """
    Determine course category based on enrollment status.
    Wrapper for shared utility function.
    """
    return determine_category(enrollment_status)

def upload_profile_picture(db: Session, *, user_id: int, file_bytes: bytes) -> Dict[str, Any]:
    """
    Upload or update user's profile picture to Cloudinary.
    If user already has a profile picture, delete the old one first.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return make_response(False, "User not found", status_code=404)
    
    try:
        # Delete old profile picture if exists
        if user.profile_picture_public_id:
            try:
                delete_file_by_public_id(user.profile_picture_public_id)
            except Exception as e:
                print(f"Failed to delete old profile picture: {e}")
        
        # Upload new profile picture
        result = upload_image_bytes(file_bytes)
        
        # Update user record
        user.profile_picture_url = result["secure_url"]
        user.profile_picture_public_id = result["public_id"]
        db.commit()
        db.refresh(user)
        
        return make_response(True, "Profile picture uploaded successfully", data={
            "profile_picture_url": user.profile_picture_url
        }, status_code=200)
        
    except Exception as e:
        db.rollback()
        return make_response(False, "Failed to upload profile picture", status_code=500, error=str(e))


def remove_profile_picture(db: Session, *, user_id: int) -> Dict[str, Any]:
    """
    Remove user's profile picture from Cloudinary and database.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return make_response(False, "User not found", status_code=404)
    
    if not user.profile_picture_public_id:
        return make_response(False, "No profile picture to remove", status_code=404)
    
    try:
        # Delete from Cloudinary
        delete_file_by_public_id(user.profile_picture_public_id)
        
        # Update user record
        user.profile_picture_url = None
        user.profile_picture_public_id = None
        db.commit()
        
        return make_response(True, "Profile picture removed successfully", status_code=200)
        
    except Exception as e:
        db.rollback()
        return make_response(False, "Failed to remove profile picture", status_code=500, error=str(e))


def get_user_profile(db: Session, *, user_id: int) -> Dict[str, Any]:
    """
    Get user profile information including profile picture.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return make_response(False, "User not found", status_code=404)
    
    return make_response(True, "User profile fetched successfully", data={
        "id": user.id,
        "name": user.Name,
        "email": user.email,
        "profile_picture_url": user.profile_picture_url,
        "role": user.role.value if user.role else None,
        "created_at": user.created_at
    }, status_code=200)


def enroll_course(db: Session, *, user_id: int, course_id: int) -> Dict[str, Any]:
    """
    Enroll user in a course (Start button functionality).
    Idempotent - returns existing enrollment if already enrolled.
    """
    # Verify course exists and is active
    course = content_repo.get_course(db, course_id=course_id)
    if not course:
        return make_response(False, "Course not found", status_code=404)
    
    if not course.is_active:
        return make_response(False, "Cannot enroll in inactive course", status_code=400)
    
    try:
        # Create enrollment (idempotent)
        enrollment = enrollment_repo.enroll_user(db, user_id=user_id, course_id=course_id)
        
        # Get full enrollment status
        enrollment_status = enrollment_repo.get_enrollment_with_status(
            db, user_id=user_id, course_id=course_id
        )
        
        return make_response(True, "Enrolled successfully", data={
            "course_id": course_id,
            "category": _determine_category(enrollment_status),
            "enrolled_at": enrollment_status["enrolled_at"],
            "deadline_at": enrollment_status["deadline_at"],
            "days_remaining": enrollment_status["days_remaining"],
            "can_interact": enrollment_status["can_interact"]
        }, status_code=200)
    except Exception as e:
        return make_response(False, "Failed to enroll in course", status_code=500, error=str(e))


def unenroll_course(db: Session, *, user_id: int, course_id: int) -> Dict[str, Any]:
    """
    Unenroll user from a course.
    Deletes enrollment and all associated progress and quiz attempts.
    """
    try:
        deleted = enrollment_repo.unenroll_user(db, user_id=user_id, course_id=course_id)
        
        if not deleted:
            return make_response(False, "Not enrolled in this course", status_code=404)
        
        return make_response(True, "Unenrolled successfully", data={
            "course_id": course_id,
            "deleted": True
        }, status_code=200)
    except Exception as e:
        return make_response(False, "Failed to unenroll from course", status_code=500, error=str(e))
