"""
Shared utilities for building enrollment-based course overviews.
Used by employee overview and team member progress endpoints.
"""
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Set, Optional
from app.repositories import course_enrollment_repo as enrollment_repo
from app.services import courseContent_service
from app.utils.course_progress import calculate_course_progress


def determine_category(enrollment_status: Dict[str, Any]) -> str:
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


def build_enrollment_based_overview(
    db: Session,
    *,
    user_id: int,
    include_starred: bool = False,
    starred_ids: Optional[Set[int]] = None
) -> Dict[str, Any]:
    """
    Build course overview based on enrollment status.
    
    Args:
        db: Database session
        user_id: User ID to build overview for
        include_starred: Whether to include starred courses category
        starred_ids: Set of starred course IDs (required if include_starred=True)
    
    Returns:
        Dictionary with categorized courses and statistics
    """
    # Get all active courses
    courses_data = courseContent_service.list_courses(db, active_only=True)
    all_courses = courses_data.get("courses", [])
    
    # Initialize categories
    starred_courses = [] if include_starred else None
    in_progress_courses = []
    completed_courses = []
    expired_courses = []
    
    # Initialize stats
    total_enrolled = 0
    total_progress_sum = 0.0
    total_items_completed = 0
    total_items = 0
    total_quizzes_completed = 0
    total_quizzes = 0
    
    for course in all_courses:
        course_id = course["id"]
        
        # Get enrollment status
        enrollment_status = enrollment_repo.get_enrollment_with_status(
            db, user_id=user_id, course_id=course_id
        )
        
        # Determine category
        category = determine_category(enrollment_status)
        
        # Calculate progress only for enrolled courses
        progress_data = None
        if enrollment_status["is_enrolled"]:
            total_enrolled += 1
            progress_calc = calculate_course_progress(db, user_id=user_id, course_id=course_id)
            progress_data = progress_calc
            
            # Accumulate stats
            total_progress_sum += progress_calc["percent"]
            total_items_completed += progress_calc["completed_items"]
            total_items += progress_calc["total_items"]
            total_quizzes_completed += progress_calc["completed_quizzes"]
            total_quizzes += progress_calc["total_quizzes"]
        
        # Build course info
        course_info = {
            "id": course_id,
            "title": course["title"],
            "description": course.get("description"),
            "department": course.get("department"),
            "thumbnail_url": course.get("thumbnail_url"),
            "category": category,
            "enrolled_at": enrollment_status["enrolled_at"],
            "completed_at": enrollment_status["completed_at"],
            "deadline_at": enrollment_status["deadline_at"],
            "days_remaining": enrollment_status["days_remaining"],
            "can_interact": enrollment_status["can_interact"],
        }
        
        # Add progress data if enrolled
        if progress_data:
            # Get per-quiz scores for manager view
            from shared.repos.course_quiz_repo import get_course_quizzes_by_course
            from shared.models.course_quiz import QuizStatus as CQStatus
            from shared.repos import quiz_attempt_repo
            from shared.services.quiz_status_service import calculate_quiz_status

            published_quizzes = get_course_quizzes_by_course(db, course_id, CQStatus.PUBLISHED)
            quiz_scores = []
            for q in published_quizzes:
                attempts = quiz_attempt_repo.get_user_quiz_attempts(db, user_id, q.id)
                best_score = max((float(a.percentage) for a in attempts), default=None)
                passed = any(a.passed for a in attempts)
                quiz_scores.append({
                    "quiz_id": q.id,
                    "title": q.title,
                    "best_score": best_score,
                    "passed": passed,
                    "attempts_used": len(attempts),
                })

            course_info.update({
                "progress": progress_data["percent"],
                "completed_items": progress_data["completed_items"],
                "total_items": progress_data["total_items"],
                "completed_quizzes": progress_data["completed_quizzes"],
                "total_quizzes": progress_data["total_quizzes"],
                "quiz_scores": quiz_scores,
            })
        
        # Add starred flag if requested
        if include_starred:
            course_info["is_starred"] = course_id in starred_ids
        
        # Categorize courses
        if include_starred and starred_ids and course_id in starred_ids:
            starred_courses.append(course_info)
        
        if category == "in_progress":
            in_progress_courses.append(course_info)
        elif category == "completed":
            completed_courses.append(course_info)
        elif category == "expired":
            expired_courses.append(course_info)
    
    # Calculate overall progress (average of enrolled courses)
    overall_progress = round(total_progress_sum / total_enrolled, 2) if total_enrolled > 0 else 0.0
    
    # Build statistics
    stats = {
        "total_enrolled": total_enrolled,
        "total_courses_started": total_enrolled,  # Alias for frontend compatibility
        "total_in_progress": len(in_progress_courses),
        "total_completed": len(completed_courses),
        "total_expired": len(expired_courses),
        "overall_progress": overall_progress,
        "total_items_completed": total_items_completed,
        "total_items": total_items,
        "total_quizzes_completed": total_quizzes_completed,
        "total_quizzes": total_quizzes,
    }
    
    if include_starred:
        stats["total_starred"] = len(starred_courses)
    
    result = {
        "stats": stats,
        "in_progress": in_progress_courses,
        "completed": completed_courses,
        "expired": expired_courses,
    }
    
    if include_starred:
        result["starred"] = starred_courses
    
    return result
