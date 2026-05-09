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
    Uses batch queries to avoid N+1 performance issues.
    """
    from shared.models.course_content import ContentItem
    from shared.models.progress import UserProgress
    from shared.models.course_quiz import CourseQuiz, QuizStatus
    from shared.models.quiz_attempt import QuizAttempt

    # ── 1. All active courses ────────────────────────────────────────────────
    courses_data = courseContent_service.list_courses(db, active_only=True)
    all_courses = courses_data.get("courses", [])
    all_course_ids = [c["id"] for c in all_courses]

    if not all_course_ids:
        result = {"stats": _empty_stats(include_starred), "in_progress": [], "completed": [], "expired": []}
        if include_starred:
            result["starred"] = []
        return result

    # ── 2. Batch fetch enrollments ───────────────────────────────────────────
    enrollments = enrollment_repo.get_all_enrollments_for_user(db, user_id=user_id)
    enrollment_map = {e.course_id: e for e in enrollments}
    course_map = {c["id"]: c for c in all_courses}

    # ── 3. Batch fetch content items ─────────────────────────────────────────
    all_items = (
        db.query(ContentItem)
        .filter(ContentItem.course_id.in_(all_course_ids))
        .all()
    )
    items_by_course: Dict[int, list] = {}
    all_content_ids = []
    for item in all_items:
        items_by_course.setdefault(item.course_id, []).append(item)
        all_content_ids.append(item.id)

    # ── 4. Batch fetch progress rows ─────────────────────────────────────────
    progress_rows = (
        db.query(UserProgress)
        .filter(UserProgress.user_id == user_id, UserProgress.content_id.in_(all_content_ids))
        .all()
        if all_content_ids else []
    )
    progress_map = {r.content_id: r for r in progress_rows}

    # ── 5. Batch fetch published quizzes ─────────────────────────────────────
    published_quizzes = (
        db.query(CourseQuiz)
        .filter(CourseQuiz.course_id.in_(all_course_ids), CourseQuiz.status == QuizStatus.PUBLISHED)
        .all()
    )
    quizzes_by_course: Dict[int, list] = {}
    all_quiz_ids = []
    for q in published_quizzes:
        quizzes_by_course.setdefault(q.course_id, []).append(q)
        all_quiz_ids.append(q.id)

    # ── 6. Batch fetch quiz attempts ─────────────────────────────────────────
    quiz_attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == user_id, QuizAttempt.quiz_id.in_(all_quiz_ids))
        .all()
        if all_quiz_ids else []
    )
    attempts_by_quiz: Dict[int, list] = {}
    for a in quiz_attempts:
        attempts_by_quiz.setdefault(a.quiz_id, []).append(a)

    # ── 7. Build response in Python ──────────────────────────────────────────
    starred_courses = [] if include_starred else None
    in_progress_courses: list = []
    completed_courses: list = []
    expired_courses: list = []

    total_enrolled = 0
    total_progress_sum = 0.0
    total_items_completed = 0
    total_items_count = 0
    total_quizzes_completed = 0
    total_quizzes_count = 0

    for course in all_courses:
        course_id = course["id"]
        enrollment = enrollment_map.get(course_id)
        course_obj = course_map[course_id]

        if not enrollment:
            enrollment_status = {
                "is_enrolled": False, "status": "not_enrolled",
                "enrolled_at": None, "completed_at": None,
                "deadline_at": None, "days_remaining": None, "can_interact": False,
            }
        else:
            deadline_at = enrollment_repo.calculate_deadline(
                enrollment,
                type("C", (), {"deadline_weeks": course_obj.get("deadline_weeks")})()
            )
            is_expired = enrollment_repo.is_deadline_expired(deadline_at)
            if enrollment.completed_at:
                status = "completed"
            elif is_expired:
                status = "expired"
            else:
                status = "active"
            enrollment_status = {
                "is_enrolled": True, "status": status,
                "enrolled_at": enrollment.enrolled_at,
                "completed_at": enrollment.completed_at,
                "deadline_at": deadline_at,
                "days_remaining": enrollment_repo.calculate_days_remaining(deadline_at),
                "can_interact": status == "active",
            }

        category = determine_category(enrollment_status)

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

        if enrollment_status["is_enrolled"]:
            total_enrolled += 1
            items = items_by_course.get(course_id, [])
            content_ids = [i.id for i in items]
            completed_items = sum(
                1 for cid in content_ids
                if cid in progress_map and (
                    progress_map[cid].completed_at is not None or
                    (progress_map[cid].progress or 0) >= 100.0
                )
            )
            quizzes = quizzes_by_course.get(course_id, [])
            completed_quizzes = sum(
                1 for q in quizzes
                if any(a.passed for a in attempts_by_quiz.get(q.id, []))
            )
            total_q = len(quizzes)
            total_c = len(content_ids)
            total = total_c + total_q
            percent = round((completed_items + completed_quizzes) / total * 100.0, 2) if total > 0 else 0.0

            # Per-quiz scores
            quiz_scores = []
            for q in quizzes:
                attempts = attempts_by_quiz.get(q.id, [])
                best_score = max((float(a.percentage) for a in attempts), default=None)
                quiz_scores.append({
                    "quiz_id": q.id,
                    "title": q.title,
                    "best_score": best_score,
                    "passed": any(a.passed for a in attempts),
                    "attempts_used": len(attempts),
                })

            course_info.update({
                "progress": percent,
                "completed_items": completed_items,
                "total_items": total_c,
                "completed_quizzes": completed_quizzes,
                "total_quizzes": total_q,
                "quiz_scores": quiz_scores,
            })

            # Self-heal: if progress is 100% but enrollment isn't marked complete, fix it now
            if percent >= 100.0 and enrollment and not enrollment.completed_at:
                from datetime import datetime, timezone
                enrollment.completed_at = datetime.now(timezone.utc)
                db.commit()
                course_info["completed_at"] = enrollment.completed_at
                category = "completed"
                course_info["category"] = "completed"

            total_progress_sum += percent
            total_items_completed += completed_items
            total_items_count += total_c
            total_quizzes_completed += completed_quizzes
            total_quizzes_count += total_q

        if include_starred and starred_ids and course_id in starred_ids:
            course_info["is_starred"] = True
            starred_courses.append(course_info)
        elif include_starred:
            course_info["is_starred"] = False

        if category == "in_progress":
            in_progress_courses.append(course_info)
        elif category == "completed":
            completed_courses.append(course_info)
        elif category == "expired":
            expired_courses.append(course_info)

    overall_progress = round(total_progress_sum / total_enrolled, 2) if total_enrolled > 0 else 0.0

    stats = {
        "total_enrolled": total_enrolled,
        "total_courses_started": total_enrolled,
        "total_in_progress": len(in_progress_courses),
        "total_completed": len(completed_courses),
        "total_expired": len(expired_courses),
        "overall_progress": overall_progress,
        "total_items_completed": total_items_completed,
        "total_items": total_items_count,
        "total_quizzes_completed": total_quizzes_completed,
        "total_quizzes": total_quizzes_count,
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


def _empty_stats(include_starred: bool) -> Dict[str, Any]:
    stats = {
        "total_enrolled": 0, "total_courses_started": 0,
        "total_in_progress": 0, "total_completed": 0, "total_expired": 0,
        "overall_progress": 0.0, "total_items_completed": 0, "total_items": 0,
        "total_quizzes_completed": 0, "total_quizzes": 0,
    }
    if include_starred:
        stats["total_starred"] = 0
    return stats
