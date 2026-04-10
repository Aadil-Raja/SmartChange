from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from shared.repos import course_quiz_repo, quiz_attempt_repo, quiz_configuration_repo
from shared.models.course_quiz import QuizStatus
from shared.models.course_quiz_question import QuestionType


def calculate_quiz_status_from_data(quiz, config: dict, attempts: list, unlock_status: dict) -> dict:
    """
    Pure-Python quiz status calculation — no DB calls.
    All data must be pre-fetched and passed in.
    """
    MAX_ATTEMPTS = config["max_attempts"]
    PASSING_SCORE = config["passing_score"]
    COOLDOWN_MINUTES = config["cooldown_minutes"]

    if quiz.status != QuizStatus.PUBLISHED:
        return {
            "status": "locked", "reason": "Quiz not published",
            "attempts_used": 0, "attempts_remaining": MAX_ATTEMPTS,
            "best_score": None, "can_retake": False,
            "next_attempt_at": None, "missing_prerequisites": [],
        }

    if not unlock_status["is_unlocked"]:
        return {
            "status": "locked", "reason": "Prerequisites not met",
            "attempts_used": 0, "attempts_remaining": MAX_ATTEMPTS,
            "best_score": None, "can_retake": False,
            "next_attempt_at": None,
            "missing_prerequisites": unlock_status["missing_prerequisites"],
        }

    attempts_used = len(attempts)
    attempts_remaining = max(0, MAX_ATTEMPTS - attempts_used)
    best_score = max((float(a.percentage) for a in attempts), default=None)

    if not attempts:
        return {
            "status": "can_take", "reason": "First attempt available",
            "attempts_used": 0, "attempts_remaining": MAX_ATTEMPTS,
            "best_score": None, "can_retake": True,
            "next_attempt_at": None, "missing_prerequisites": [],
        }

    if best_score >= PASSING_SCORE:
        return {
            "status": "completed", "reason": f"Passed with {best_score}%",
            "attempts_used": attempts_used, "attempts_remaining": attempts_remaining,
            "best_score": best_score, "can_retake": False,
            "next_attempt_at": None, "missing_prerequisites": [],
        }

    if attempts_used >= MAX_ATTEMPTS:
        return {
            "status": "max_attempts_reached", "reason": f"Used all {MAX_ATTEMPTS} attempts",
            "attempts_used": attempts_used, "attempts_remaining": 0,
            "best_score": best_score, "can_retake": False,
            "next_attempt_at": None, "missing_prerequisites": [],
        }

    last_attempt = attempts[0]
    time_since_last = datetime.now(timezone.utc) - last_attempt.completed_at
    cooldown_remaining = timedelta(minutes=COOLDOWN_MINUTES) - time_since_last

    if cooldown_remaining.total_seconds() > 0:
        next_attempt_at = last_attempt.completed_at + timedelta(minutes=COOLDOWN_MINUTES)
        return {
            "status": "in_cooldown",
            "reason": f"Must wait {int(cooldown_remaining.total_seconds() / 60)} more minutes",
            "attempts_used": attempts_used, "attempts_remaining": attempts_remaining,
            "best_score": best_score, "can_retake": True,
            "next_attempt_at": next_attempt_at, "missing_prerequisites": [],
        }

    return {
        "status": "can_take", "reason": "Can retake to improve score",
        "attempts_used": attempts_used, "attempts_remaining": attempts_remaining,
        "best_score": best_score, "can_retake": True,
        "next_attempt_at": None, "missing_prerequisites": [],
    }


def calculate_quiz_status(db: Session, user_id: int, quiz) -> Dict[str, Any]:
    """Calculate quiz status and attempt information for a user"""
    
    # Get quiz-specific configuration
    config = quiz_configuration_repo.get_quiz_config(db, quiz.id)
    MAX_ATTEMPTS = config["max_attempts"]
    PASSING_SCORE = config["passing_score"]
    COOLDOWN_MINUTES = config["cooldown_minutes"]
    
    # Check if quiz is published
    if quiz.status != QuizStatus.PUBLISHED:
        return {
            "status": "locked",
            "reason": "Quiz not published",
            "attempts_used": 0,
            "attempts_remaining": MAX_ATTEMPTS,
            "best_score": None,
            "can_retake": False,
            "next_attempt_at": None,
            "missing_prerequisites": []
        }
    
    # Check prerequisites
    unlock_status = course_quiz_repo.check_quiz_unlock_status(db, user_id, quiz)
    if not unlock_status["is_unlocked"]:
        missing_items = unlock_status["missing_prerequisites"]
        return {
            "status": "locked",
            "reason": "Prerequisites not met",
            "attempts_used": 0,
            "attempts_remaining": MAX_ATTEMPTS,
            "best_score": None,
            "can_retake": False,
            "next_attempt_at": None,
            "missing_prerequisites": missing_items
        }
    
    # Get user's attempts for this quiz
    attempts = quiz_attempt_repo.get_user_quiz_attempts(db, user_id, quiz.id)
    attempts_used = len(attempts)
    attempts_remaining = max(0, MAX_ATTEMPTS - attempts_used)
    
    # Calculate best score
    best_score = None
    if attempts:
        best_score = max(float(attempt.percentage) for attempt in attempts)
    
    # No attempts yet - can take
    if not attempts:
        return {
            "status": "can_take",
            "reason": "First attempt available",
            "attempts_used": 0,
            "attempts_remaining": MAX_ATTEMPTS,
            "best_score": None,
            "can_retake": True,
            "next_attempt_at": None,
            "missing_prerequisites": []
        }
    
    # Check if already passed
    if best_score >= PASSING_SCORE:
        return {
            "status": "completed",
            "reason": f"Passed with {best_score}%",
            "attempts_used": attempts_used,
            "attempts_remaining": attempts_remaining,
            "best_score": best_score,
            "can_retake": False,
            "next_attempt_at": None,
            "missing_prerequisites": []
        }
    
    # Check if max attempts reached
    if attempts_used >= MAX_ATTEMPTS:
        return {
            "status": "max_attempts_reached",
            "reason": f"Used all {MAX_ATTEMPTS} attempts",
            "attempts_used": attempts_used,
            "attempts_remaining": 0,
            "best_score": best_score,
            "can_retake": False,
            "next_attempt_at": None,
            "missing_prerequisites": []
        }
    
    # Check cooldown period
    last_attempt = attempts[0]  # Most recent (ordered by completed_at desc)
    time_since_last = datetime.now(timezone.utc) - last_attempt.completed_at
    cooldown_remaining = timedelta(minutes=COOLDOWN_MINUTES) - time_since_last
    
    if cooldown_remaining.total_seconds() > 0:
        next_attempt_at = last_attempt.completed_at + timedelta(minutes=COOLDOWN_MINUTES)
        return {
            "status": "in_cooldown",
            "reason": f"Must wait {int(cooldown_remaining.total_seconds() / 60)} more minutes",
            "attempts_used": attempts_used,
            "attempts_remaining": attempts_remaining,
            "best_score": best_score,
            "can_retake": True,
            "next_attempt_at": next_attempt_at,
            "missing_prerequisites": []
        }
    
    # Can retake
    return {
        "status": "can_take",
        "reason": "Can retake to improve score",
        "attempts_used": attempts_used,
        "attempts_remaining": attempts_remaining,
        "best_score": best_score,
        "can_retake": True,
        "next_attempt_at": None,
        "missing_prerequisites": []
    }