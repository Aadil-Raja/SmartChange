from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from shared.models.quiz_attempt import QuizAttempt


def create_quiz_attempt(
    db: Session,
    *,
    user_id: int,
    quiz_id: int,
    answers: Dict[str, int],  # {"question_id": selected_option_index}
    score: int,
    total_questions: int,
    percentage: float,
    passed: bool
) -> QuizAttempt:
    """Create a new quiz attempt record"""
    attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=quiz_id,
        answers=answers,
        score=score,
        total_questions=total_questions,
        percentage=percentage,
        passed=passed,
        completed_at=datetime.now(timezone.utc)
    )
    
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def get_quiz_attempt_by_id(db: Session, attempt_id: int) -> Optional[QuizAttempt]:
    """Get quiz attempt by ID"""
    return db.query(QuizAttempt).filter(QuizAttempt.id == attempt_id).first()


def get_user_quiz_attempts(
    db: Session, 
    user_id: int, 
    quiz_id: int
) -> List[QuizAttempt]:
    """Get all attempts by a user for a specific quiz"""
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.quiz_id == quiz_id
        )
        .order_by(QuizAttempt.completed_at.desc())
        .all()
    )


def get_user_attempts_for_quizzes(
    db: Session,
    user_id: int,
    quiz_ids: List[int]
) -> Dict[int, List[QuizAttempt]]:
    """Batch-fetch all attempts for a user across multiple quizzes. Returns dict keyed by quiz_id."""
    if not quiz_ids:
        return {}
    attempts = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.quiz_id.in_(quiz_ids)
        )
        .order_by(QuizAttempt.completed_at.desc())
        .all()
    )
    result: Dict[int, List[QuizAttempt]] = {qid: [] for qid in quiz_ids}
    for a in attempts:
        result[a.quiz_id].append(a)
    return result


def get_user_best_attempt(
    db: Session,
    user_id: int,
    quiz_id: int
) -> Optional[QuizAttempt]:
    """Get user's best attempt for a quiz (highest score)"""
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.quiz_id == quiz_id
        )
        .order_by(QuizAttempt.percentage.desc(), QuizAttempt.completed_at.desc())
        .first()
    )


def get_user_latest_attempt(
    db: Session, 
    user_id: int, 
    quiz_id: int
) -> Optional[QuizAttempt]:
    """Get user's most recent attempt for a quiz"""
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.quiz_id == quiz_id
        )
        .order_by(QuizAttempt.completed_at.desc())
        .first()
    )


def count_user_quiz_attempts(db: Session, user_id: int, quiz_id: int) -> int:
    """Count how many times user has attempted a quiz"""
    return (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.quiz_id == quiz_id
        )
        .count()
    )