from app.repositories import teams_repo
from app.utils.response_utils import make_response
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from shared.models import Team, TeamMember, TeamMemberRole, User
from app.repositories import progress_repo as prog_repo
from app.repositories import courseContent_repo as content_repo
from app.repositories import course_stars_repo
from app.services import courseContent_service
from app.services.storage.storage_cloudinary import upload_image_bytes, delete_file_by_public_id
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
    mark_complete = bool(completed) or progress >= 100.0
    row = prog_repo.upsert_progress(
        db,
        user_id=user_id,
        content_id=content_id,
        progress=progress,
        mark_complete=mark_complete,
    )
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
    # all items in the course
    items = content_repo.list_items_for_course(db, course_id=course_id)
    content_ids = [it.id for it in items]
    total_items = len(content_ids)
    
    if total_items == 0:
        return {"course_id": course_id, "completed_items": 0, "total_items": 0, "percent": 0.0}
    
    # user progress rows
    rows = prog_repo.list_for_user_and_content_ids(db, user_id=user_id, content_ids=content_ids)
    
    # completed = completed_at not null OR progress >= 100
    completed_ids = {r.content_id for r in rows if r.completed_at is not None or (r.progress or 0) >= 100.0}
    completed_items = len(completed_ids)
    percent = round((completed_items / total_items) * 100.0, 2)
    
    return {
        "course_id": course_id,
        "completed_items": completed_items,
        "total_items": total_items,
        "percent": percent,
    }

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
        
        progress_data = course_progress(db, user_id=user_id, course_id=course["id"])
        
        result.append({
            "id": course["id"],
            "title": course["title"],
            "description": course.get("description"),
            "progress": progress_data["percent"],
            "completed_items": progress_data["completed_items"],
            "total_items": progress_data["total_items"],
            "is_completed": progress_data["percent"] >= 100.0,
             "department": course.get("department"),
                "thumbnail_url": course.get("thumbnail_url"),
        })
    
    return {"starred_courses": result}


def get_courses_overview(db: Session, *, user_id: int) -> Dict[str, Any]:
    """
    Get comprehensive overview of user's courses categorized by:
    - Starred courses
    - In Progress courses (not completed)
    - Completed courses
    Plus overall statistics and user information
    """
    # Get user information
    user = db.query(User).filter(User.id == user_id).first()
    user_name = user.Name if user else None
    
    # Get all active courses
    all_courses_data = courseContent_service.list_courses(db, active_only=True)
    all_courses = all_courses_data.get("courses", [])
    
    # Get starred course IDs
    starred_ids = set(course_stars_repo.list_starred_course_ids(db, user_id=user_id))
    
    starred_courses = []
    in_progress_courses = []
    completed_courses = []
    
    for course in all_courses:
        course_id = course["id"]
        
        # Calculate progress
        progress_data = course_progress(db, user_id=user_id, course_id=course_id)
        percent = progress_data["percent"]
        
        course_info = {
            "id": course_id,
            "title": course["title"],
            "description": course.get("description"),
            "progress": percent,
            "completed_items": progress_data["completed_items"],
            "total_items": progress_data["total_items"],
            "is_starred": course_id in starred_ids,
            "department": course.get("department"),
            "thumbnail_url": course.get("thumbnail_url"),
        }
        
        # Categorize
        if course_id in starred_ids:
            starred_courses.append(course_info)
        
        if percent >= 100.0:
            completed_courses.append(course_info)
        elif percent > 0:
            in_progress_courses.append(course_info)
    
    # Calculate statistics
    total_completed = len(completed_courses)
    total_in_progress = len(in_progress_courses)
    total_starred = len(starred_courses)
    total_courses_started = total_completed + total_in_progress
    
    # Calculate overall progress percentage (across all courses with progress)
    if total_courses_started > 0:
        overall_progress = round(
            sum(c["progress"] for c in (in_progress_courses + completed_courses)) / total_courses_started,
            2
        )
    else:
        overall_progress = 0.0
    
    # Calculate total items completed vs total items across all started courses
    total_items_completed = sum(c["completed_items"] for c in (in_progress_courses + completed_courses))
    total_items = sum(c["total_items"] for c in (in_progress_courses + completed_courses))
    
    stats = {
        "total_courses_started": total_courses_started,
        "total_in_progress": total_in_progress,
        "total_completed": total_completed,
        "total_starred": total_starred,
        "overall_progress": overall_progress,
        "total_items_completed": total_items_completed,
        "total_items": total_items,
    }
    
    return {
        "user_name": user_name,
        "profile_picture_url": user.profile_picture_url if user else None,
        "stats": stats,
        "starred": starred_courses,
        "in_progress": in_progress_courses,
        "completed": completed_courses,
    }

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
