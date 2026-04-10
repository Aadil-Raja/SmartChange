"""
Repository for course enrollment operations.
Handles enrollment creation, deletion, status checking, and deadline calculations.
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from shared.models.course_enrollment import CourseEnrollment
from shared.models.course import Course
from shared.models.progress import UserProgress
from shared.models.quiz_attempt import QuizAttempt


def enroll_user(db: Session, *, user_id: int, course_id: int) -> CourseEnrollment:
    """
    Create enrollment record for a user in a course.
    Idempotent - returns existing enrollment if already enrolled.
    
    Args:
        db: Database session
        user_id: ID of the user enrolling
        course_id: ID of the course to enroll in
    
    Returns:
        CourseEnrollment object
    """
    # Check if already enrolled
    existing = get_enrollment(db, user_id=user_id, course_id=course_id)
    if existing:
        return existing
    
    # Create new enrollment
    enrollment = CourseEnrollment(
        user_id=user_id,
        course_id=course_id
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    
    return enrollment


def get_enrollment(db: Session, *, user_id: int, course_id: int) -> Optional[CourseEnrollment]:
    """
    Get enrollment record for a user in a course.
    
    Args:
        db: Database session
        user_id: ID of the user
        course_id: ID of the course
    
    Returns:
        CourseEnrollment object or None if not enrolled
    """
    return db.query(CourseEnrollment).filter(
        and_(
            CourseEnrollment.user_id == user_id,
            CourseEnrollment.course_id == course_id
        )
    ).first()


def unenroll_user(db: Session, *, user_id: int, course_id: int) -> bool:
    """
    Delete enrollment and all associated progress/quiz attempts.
    
    This will cascade delete:
    - All content progress records for this user+course
    - All quiz attempts for this user+course
    
    Args:
        db: Database session
        user_id: ID of the user
        course_id: ID of the course
    
    Returns:
        True if enrollment was deleted, False if not enrolled
    """
    enrollment = get_enrollment(db, user_id=user_id, course_id=course_id)
    if not enrollment:
        return False
    
    # Get all content IDs for this course
    from app.repositories import courseContent_repo
    content_items = courseContent_repo.list_items_for_course(db, course_id=course_id)
    content_ids = [item.id for item in content_items]
    
    # Delete all progress records for this user+course
    if content_ids:
        db.query(UserProgress).filter(
            and_(
                UserProgress.user_id == user_id,
                UserProgress.content_id.in_(content_ids)
            )
        ).delete(synchronize_session=False)
    
    # Delete all quiz attempts for this user+course quizzes
    from shared.repos.course_quiz_repo import get_course_quizzes_by_course
    
    quizzes = get_course_quizzes_by_course(db, course_id, status=None)
    quiz_ids = [quiz.id for quiz in quizzes]
    
    if quiz_ids:
        db.query(QuizAttempt).filter(
            and_(
                QuizAttempt.user_id == user_id,
                QuizAttempt.quiz_id.in_(quiz_ids)
            )
        ).delete(synchronize_session=False)
    
    # Delete enrollment record
    db.delete(enrollment)
    db.commit()
    
    return True


def calculate_deadline(enrollment: CourseEnrollment, course: Course) -> Optional[datetime]:
    """
    Calculate deadline datetime based on enrollment date and course deadline_weeks.
    
    Args:
        enrollment: CourseEnrollment object
        course: Course object
    
    Returns:
        Deadline datetime or None if no deadline configured
    """
    if not course.deadline_weeks:
        return None
    
    return enrollment.enrolled_at + timedelta(weeks=course.deadline_weeks)


def is_deadline_expired(deadline_at: Optional[datetime]) -> bool:
    """
    Check if deadline has passed.
    
    Args:
        deadline_at: Deadline datetime or None
    
    Returns:
        True if deadline has passed, False otherwise (including no deadline)
    """
    if not deadline_at:
        return False
    
    return datetime.now(timezone.utc) > deadline_at


def calculate_days_remaining(deadline_at: Optional[datetime]) -> Optional[int]:
    """
    Calculate days remaining until deadline.
    
    Args:
        deadline_at: Deadline datetime or None
    
    Returns:
        Days remaining (can be negative if expired) or None if no deadline
    """
    if not deadline_at:
        return None
    
    delta = deadline_at - datetime.now(timezone.utc)
    return delta.days


def get_enrollment_status(enrollment: Optional[CourseEnrollment], course: Course) -> str:
    """
    Calculate enrollment status.
    
    Args:
        enrollment: CourseEnrollment object or None
        course: Course object
    
    Returns:
        Status string: "not_enrolled" | "active" | "expired" | "completed"
    """
    if not enrollment:
        return "not_enrolled"
    
    if enrollment.completed_at:
        return "completed"
    
    deadline_at = calculate_deadline(enrollment, course)
    if is_deadline_expired(deadline_at):
        return "expired"
    
    return "active"


def get_enrollment_with_status(db: Session, *, user_id: int, course_id: int) -> Dict[str, Any]:
    """
    Get enrollment with calculated deadline and status information.
    
    Args:
        db: Database session
        user_id: ID of the user
        course_id: ID of the course
    
    Returns:
        Dictionary with enrollment status and metadata:
        {
            "is_enrolled": bool,
            "status": str,  # "not_enrolled" | "active" | "expired" | "completed"
            "enrolled_at": datetime or None,
            "completed_at": datetime or None,
            "deadline_at": datetime or None,
            "is_expired": bool,
            "days_remaining": int or None,
            "can_interact": bool  # False if not_enrolled or expired
        }
    """
    enrollment = get_enrollment(db, user_id=user_id, course_id=course_id)
    course = db.query(Course).filter(Course.id == course_id).first()
    
    if not course:
        raise ValueError("Course not found")
    
    if not enrollment:
        return {
            "is_enrolled": False,
            "status": "not_enrolled",
            "enrolled_at": None,
            "completed_at": None,
            "deadline_at": None,
            "is_expired": False,
            "days_remaining": None,
            "can_interact": False
        }
    
    deadline_at = calculate_deadline(enrollment, course)
    is_expired = is_deadline_expired(deadline_at)
    status = get_enrollment_status(enrollment, course)
    days_remaining = calculate_days_remaining(deadline_at)
    
    # Can interact if enrolled, active (not expired), and not completed
    can_interact = status == "active"
    
    return {
        "is_enrolled": True,
        "status": status,
        "enrolled_at": enrollment.enrolled_at,
        "completed_at": enrollment.completed_at,
        "deadline_at": deadline_at,
        "is_expired": is_expired,
        "days_remaining": days_remaining,
        "can_interact": can_interact
    }


def reopen_completed_enrollments(db: Session, *, course_id: int) -> int:
    """
    Clear completed_at for all users who have completed this course.
    Called when admin publishes a course, so employees must complete
    any new material before being considered done.

    Returns the number of enrollments reopened.
    """
    count = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.completed_at.isnot(None),
        )
        .update({"completed_at": None}, synchronize_session=False)
    )
    db.commit()
    return count


def get_all_enrollments_for_user(db: Session, *, user_id: int) -> list[CourseEnrollment]:
    """Fetch all enrollment records for a user in one query."""
    return db.query(CourseEnrollment).filter(CourseEnrollment.user_id == user_id).all()


def mark_course_completed(db: Session, *, user_id: int, course_id: int) -> bool:
    """
    Mark course as completed by setting completed_at timestamp.
    Idempotent - does nothing if already completed.
    
    Args:
        db: Database session
        user_id: ID of the user
        course_id: ID of the course
    
    Returns:
        True if completed_at was set, False if not enrolled or already completed
    """
    enrollment = get_enrollment(db, user_id=user_id, course_id=course_id)
    
    if not enrollment:
        return False
    
    if enrollment.completed_at:
        return False  # Already completed
    
    enrollment.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(enrollment)
    
    return True


def is_course_accessible(db: Session, *, user_id: int, course_id: int) -> tuple[bool, Optional[str]]:
    """
    Check if user can interact with course content (progress updates, quizzes).
    
    Args:
        db: Database session
        user_id: ID of the user
        course_id: ID of the course
    
    Returns:
        Tuple of (is_accessible: bool, error_message: str or None)
    """
    enrollment_status = get_enrollment_with_status(db, user_id=user_id, course_id=course_id)
    
    if not enrollment_status["is_enrolled"]:
        return False, "You must enroll in this course before accessing content"
    
    if enrollment_status["status"] == "expired":
        return False, "The deadline for this course has passed"
    
    if enrollment_status["status"] == "completed":
        return False, "This course is already completed"
    
    return True, None
