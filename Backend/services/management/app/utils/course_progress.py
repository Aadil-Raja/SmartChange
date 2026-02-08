"""
Shared utilities for calculating and building course progress data.
Used by both employee and manager views to ensure consistent progress calculation.
"""
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Set, Optional
from app.repositories import progress_repo as prog_repo
from app.repositories import courseContent_repo as content_repo
from app.services import courseContent_service


def calculate_course_progress(db: Session, *, user_id: int, course_id: int) -> Dict[str, Any]:
    """
    Calculate course progress for a user including both content items and quizzes.
    
    Returns:
        {
            "course_id": int,
            "completed_items": int,
            "total_items": int,
            "completed_quizzes": int,
            "total_quizzes": int,
            "percent": float
        }
    """
    # Get all content items in the course
    items = content_repo.list_items_for_course(db, course_id=course_id)
    content_ids = [it.id for it in items]
    total_items = len(content_ids)
    
    # Get published quizzes for the course
    from shared.repos.course_quiz_repo import get_course_quizzes_by_course
    from shared.models.course_quiz import QuizStatus
    from shared.repos.quiz_attempt_repo import get_user_quiz_attempts
    
    published_quizzes = get_course_quizzes_by_course(db, course_id, QuizStatus.PUBLISHED)
    total_quizzes = len(published_quizzes)
    
    # User progress rows for content items
    rows = prog_repo.list_for_user_and_content_ids(db, user_id=user_id, content_ids=content_ids)
    
    # Completed content items = completed_at not null OR progress >= 100
    completed_ids = {r.content_id for r in rows if r.completed_at is not None or (r.progress or 0) >= 100.0}
    completed_items = len(completed_ids)
    
    # Completed quizzes = quizzes where user has passed attempts
    completed_quizzes = 0
    for quiz in published_quizzes:
        attempts = get_user_quiz_attempts(db, user_id, quiz.id)
        if any(attempt.passed for attempt in attempts):
            completed_quizzes += 1
    
    # Calculate overall progress including both content items and quizzes
    total_course_items = total_items + total_quizzes
    completed_course_items = completed_items + completed_quizzes
    
    if total_course_items == 0:
        percent = 0.0
    else:
        percent = round((completed_course_items / total_course_items) * 100.0, 2)
    
    return {
        "course_id": course_id,
        "completed_items": completed_items,
        "total_items": total_items,
        "completed_quizzes": completed_quizzes,
        "total_quizzes": total_quizzes,
        "percent": percent,
    }


def build_user_courses_overview(
    db: Session,
    *,
    user_id: int,
    include_zero_progress: bool = True,
    include_starred: bool = False,
    starred_ids: Optional[Set[int]] = None
) -> Dict[str, Any]:
    """
    Build a comprehensive overview of user's courses with progress data.
    
    Args:
        db: Database session
        user_id: User ID to calculate progress for
        include_zero_progress: If False, skip courses with 0% progress
        include_starred: If True, include starred courses category
        starred_ids: Set of starred course IDs (required if include_starred=True)
    
    Returns:
        {
            "starred": [...],  # Only if include_starred=True
            "in_progress": [...],
            "completed": [...],
            "stats": {
                "total_courses_started": int,
                "total_in_progress": int,
                "total_completed": int,
                "total_starred": int,  # Only if include_starred=True
                "overall_progress": float,
                "total_items_completed": int,
                "total_items": int,
                "total_quizzes_completed": int,
                "total_quizzes": int
            }
        }
    """
    if include_starred and starred_ids is None:
        starred_ids = set()
    
    # Get all active courses
    all_courses_data = courseContent_service.list_courses(db, active_only=True)
    all_courses = all_courses_data.get("courses", [])
    
    starred_courses = []
    in_progress_courses = []
    completed_courses = []
    
    for course in all_courses:
        course_id = course["id"]
        
        # Calculate progress
        progress_data = calculate_course_progress(db, user_id=user_id, course_id=course_id)
        percent = progress_data["percent"]
        
        # Skip courses with no progress if requested
        if not include_zero_progress and percent == 0:
            continue
        
        # Build course info
        course_info = {
            "id": course_id,
            "title": course["title"],
            "description": course.get("description"),
            "progress": percent,
            "completed_items": progress_data["completed_items"],
            "total_items": progress_data["total_items"],
            "completed_quizzes": progress_data["completed_quizzes"],
            "total_quizzes": progress_data["total_quizzes"],
            "department": course.get("department"),
            "thumbnail_url": course.get("thumbnail_url"),
        }
        
        # Add starred flag if requested
        if include_starred:
            course_info["is_starred"] = course_id in starred_ids
        
        # Categorize courses
        if include_starred and course_id in starred_ids:
            starred_courses.append(course_info)
        
        if percent >= 100.0:
            completed_courses.append(course_info)
        elif percent > 0:
            in_progress_courses.append(course_info)
    
    # Calculate statistics
    total_completed = len(completed_courses)
    total_in_progress = len(in_progress_courses)
    total_courses_started = total_completed + total_in_progress
    
    # Calculate overall progress percentage (across all courses with progress)
    if total_courses_started > 0:
        overall_progress = round(
            sum(c["progress"] for c in (in_progress_courses + completed_courses)) / total_courses_started,
            2
        )
    else:
        overall_progress = 0.0
    
    # Calculate total items and quizzes completed vs total across all started courses
    total_items_completed = sum(c["completed_items"] for c in (in_progress_courses + completed_courses))
    total_items = sum(c["total_items"] for c in (in_progress_courses + completed_courses))
    total_quizzes_completed = sum(c["completed_quizzes"] for c in (in_progress_courses + completed_courses))
    total_quizzes = sum(c["total_quizzes"] for c in (in_progress_courses + completed_courses))
    
    stats = {
        "total_courses_started": total_courses_started,
        "total_in_progress": total_in_progress,
        "total_completed": total_completed,
        "overall_progress": overall_progress,
        "total_items_completed": total_items_completed,
        "total_items": total_items,
        "total_quizzes_completed": total_quizzes_completed,
        "total_quizzes": total_quizzes,
    }
    
    if include_starred:
        stats["total_starred"] = len(starred_courses)
    
    result = {
        "in_progress": in_progress_courses,
        "completed": completed_courses,
        "stats": stats,
    }
    
    if include_starred:
        result["starred"] = starred_courses
    
    return result
