from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime
from shared.models import (
    CourseQuiz, CourseQuizQuestion, CourseQuestionDetail, CourseQuestionOption, 
    Quiz, QuizQuestion
)
from shared.models.course_quiz import QuizStatus
from shared.models.course_quiz_question import QuestionType


# ============ Course Quiz CRUD ============
def create_course_quiz(
    db: Session,
    course_id: int,
    title: str,
    created_by: int,
    description: Optional[str] = None,
    prerequisite_content_ids: Optional[List[int]] = None,
    status: QuizStatus = QuizStatus.DRAFT
) -> CourseQuiz:
    """Create a new course quiz"""
    quiz = CourseQuiz(
        course_id=course_id,
        title=title,
        description=description,
        prerequisite_content_ids=prerequisite_content_ids or [],
        created_by=created_by,
        status=status,
        total_questions=0
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


def get_course_quiz_by_id(db: Session, quiz_id: int) -> Optional[CourseQuiz]:
    """Get course quiz by ID without questions"""
    return db.query(CourseQuiz).filter(CourseQuiz.id == quiz_id).first()


def get_course_quiz_with_questions(db: Session, quiz_id: int) -> Optional[CourseQuiz]:
    """Get course quiz with all questions and options"""
    return (
        db.query(CourseQuiz)
        .options(
            joinedload(CourseQuiz.questions)
            .joinedload(CourseQuizQuestion.source_document_question)
            .joinedload(QuizQuestion.options),
            joinedload(CourseQuiz.questions)
            .joinedload(CourseQuizQuestion.course_question_detail)
            .joinedload(CourseQuestionDetail.options)
        )
        .filter(CourseQuiz.id == quiz_id)
        .first()
    )


def get_course_quizzes_by_course(
    db: Session,
    course_id: int,
    status: Optional[QuizStatus] = None
) -> List[CourseQuiz]:
    """Get all quizzes for a course through direct relationship"""
    query = db.query(CourseQuiz).filter(CourseQuiz.course_id == course_id)
    
    if status:
        query = query.filter(CourseQuiz.status == status)
    
    return query.order_by(CourseQuiz.created_at.desc()).all()


def get_all_course_quizzes_by_user(db: Session, user_id: int) -> List[CourseQuiz]:
    """Get all course quizzes created by a user"""
    return db.query(CourseQuiz).filter(CourseQuiz.created_by == user_id).order_by(CourseQuiz.created_at.desc()).all()


def get_course_id_for_quiz(db: Session, quiz_id: int) -> Optional[int]:
    """Get the course_id for a quiz through direct relationship"""
    result = db.query(CourseQuiz.course_id).filter(CourseQuiz.id == quiz_id).first()
    return result[0] if result else None


def update_course_quiz(
    db: Session,
    quiz_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    prerequisite_content_ids: Optional[List[int]] = None,
    status: Optional[QuizStatus] = None
) -> Optional[CourseQuiz]:
    """Update course quiz metadata"""
    quiz = get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return None
    
    if title is not None:
        quiz.title = title
    if description is not None:
        quiz.description = description
    if prerequisite_content_ids is not None:
        quiz.prerequisite_content_ids = prerequisite_content_ids
    if status is not None:
        quiz.status = status
    
    db.commit()
    db.refresh(quiz)
    return quiz


def update_course_quiz_status(db: Session, quiz_id: int, status: QuizStatus) -> Optional[CourseQuiz]:
    """Update course quiz status"""
    return update_course_quiz(db, quiz_id, status=status)


def publish_course_quiz(db: Session, quiz_id: int) -> Optional[CourseQuiz]:
    """Publish course quiz - sets status to PUBLISHED and sets published_at timestamp"""
    quiz = get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return None
    
    quiz.status = QuizStatus.PUBLISHED
    quiz.published_at = datetime.now()
    
    db.commit()
    db.refresh(quiz)
    return quiz


def delete_course_quiz(db: Session, quiz_id: int) -> bool:
    """Delete a course quiz (cascades to questions and options)"""
    quiz = get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return False
    db.delete(quiz)
    db.commit()
    return True


def update_total_questions(db: Session, quiz_id: int) -> Optional[CourseQuiz]:
    """Recalculate and update total_questions count"""
    quiz = get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return None
    
    count = db.query(CourseQuizQuestion).filter(CourseQuizQuestion.course_quiz_id == quiz_id).count()
    quiz.total_questions = count
    db.commit()
    db.refresh(quiz)
    return quiz


# ============ Course Quiz Question CRUD ============
def create_referenced_question(
    db: Session,
    course_quiz_id: int,
    source_document_question_id: int,
    question_order: int
) -> CourseQuizQuestion:
    """Create a referenced question (points to document quiz question)"""
    question = CourseQuizQuestion(
        course_quiz_id=course_quiz_id,
        question_type=QuestionType.REFERENCED,
        source_document_question_id=source_document_question_id,
        question_order=question_order
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def create_course_specific_question(
    db: Session,
    course_quiz_id: int,
    question_text: str,
    correct_answer_index: int,
    question_order: int,
    options: List[dict],
    explanation: Optional[str] = None
) -> CourseQuizQuestion:
    """Create a course-specific question with options"""
    # Create question detail
    detail = CourseQuestionDetail(
        question_text=question_text,
        correct_answer_index=correct_answer_index,
        explanation=explanation
    )
    db.add(detail)
    db.flush()  # Get the ID
    
    # Create options
    for opt in options:
        option = CourseQuestionOption(
            question_detail_id=detail.id,
            option_text=opt["option_text"],
            option_order=opt["option_order"]
        )
        db.add(option)
    
    # Create course quiz question
    question = CourseQuizQuestion(
        course_quiz_id=course_quiz_id,
        question_type=QuestionType.COURSE_SPECIFIC,
        course_question_detail_id=detail.id,
        question_order=question_order
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def get_course_quiz_question_by_id(db: Session, question_id: int) -> Optional[CourseQuizQuestion]:
    """Get course quiz question with related data"""
    return (
        db.query(CourseQuizQuestion)
        .options(
            joinedload(CourseQuizQuestion.source_document_question).joinedload(QuizQuestion.options),
            joinedload(CourseQuizQuestion.course_question_detail).joinedload(CourseQuestionDetail.options)
        )
        .filter(CourseQuizQuestion.id == question_id)
        .first()
    )


def convert_to_course_specific(
    db: Session,
    question_id: int,
    question_text: Optional[str] = None,
    correct_answer_index: Optional[int] = None,
    options: Optional[List[dict]] = None,
    explanation: Optional[str] = None
) -> Optional[CourseQuizQuestion]:
    """Convert a referenced question to course-specific"""
    question = get_course_quiz_question_by_id(db, question_id)
    if not question or question.question_type != QuestionType.REFERENCED:
        return None
    
    # Get original data from the referenced document question
    doc_question = question.source_document_question
    if not doc_question:
        return None
    
    # Merge provided updates with original data
    final_question_text = question_text if question_text is not None else doc_question.question_text
    final_correct_answer = correct_answer_index if correct_answer_index is not None else doc_question.correct_answer_index
    final_explanation = explanation if explanation is not None else doc_question.explanation
    
    # Handle options - use provided options or convert from document question options
    if options is not None:
        final_options = options
    else:
        final_options = [
            {
                "option_text": opt.option_text,
                "option_order": opt.option_order
            }
            for opt in doc_question.options
        ]
    
    # Create question detail with merged data
    detail = CourseQuestionDetail(
        question_text=final_question_text,
        correct_answer_index=final_correct_answer,
        explanation=final_explanation
    )
    db.add(detail)
    db.flush()
    
    # Create options
    for opt in final_options:
        option = CourseQuestionOption(
            question_detail_id=detail.id,
            option_text=opt["option_text"],
            option_order=opt["option_order"]
        )
        db.add(option)
    
    # Update question to point to course-specific detail
    question.question_type = QuestionType.COURSE_SPECIFIC
    question.source_document_question_id = None
    question.course_question_detail_id = detail.id
    
    db.commit()
    db.refresh(question)
    return question


def update_course_specific_question(
    db: Session,
    question_id: int,
    question_text: Optional[str] = None,
    correct_answer_index: Optional[int] = None,
    explanation: Optional[str] = None,
    options: Optional[List[dict]] = None
) -> Optional[CourseQuizQuestion]:
    """Update a course-specific question"""
    question = get_course_quiz_question_by_id(db, question_id)
    if not question or question.question_type != QuestionType.COURSE_SPECIFIC:
        return None
    
    detail = question.course_question_detail
    if not detail:
        return None
    
    # Update detail
    if question_text is not None:
        detail.question_text = question_text
    if correct_answer_index is not None:
        detail.correct_answer_index = correct_answer_index
    if explanation is not None:
        detail.explanation = explanation
    
    # Update options if provided
    if options is not None:
        # Delete old options
        db.query(CourseQuestionOption).filter(CourseQuestionOption.question_detail_id == detail.id).delete()
        
        # Create new options
        for opt in options:
            option = CourseQuestionOption(
                question_detail_id=detail.id,
                option_text=opt["option_text"],
                option_order=opt["option_order"]
            )
            db.add(option)
    
    db.commit()
    db.refresh(question)
    return question


def delete_course_quiz_question(db: Session, question_id: int) -> bool:
    """Delete a course quiz question"""
    question = get_course_quiz_question_by_id(db, question_id)
    if not question:
        return False
    
    quiz_id = question.course_quiz_id
    db.delete(question)
    db.commit()
    
    # Update total_questions count
    update_total_questions(db, quiz_id)
    return True


# ============ Helper Functions ============
def get_available_document_questions(db: Session, course_id: int) -> List[QuizQuestion]:
    """Get all document quiz questions available for a course"""
    from shared.models import ContentItem, ContentType
    
    # Get all documents in the course
    document_ids = (
        db.query(ContentItem.document_id)
        .filter(
            ContentItem.course_id == course_id,
            ContentItem.type == ContentType.DOCUMENT,
            ContentItem.document_id.isnot(None)
        )
        .all()
    )
    
    if not document_ids:
        return []
    
    # Get all quiz questions from those documents
    document_id_list = [doc_id[0] for doc_id in document_ids]
    
    return (
        db.query(QuizQuestion)
        .join(Quiz, QuizQuestion.quiz_id == Quiz.id)
        .filter(Quiz.document_id.in_(document_id_list))
        .options(
            joinedload(QuizQuestion.options),
            joinedload(QuizQuestion.quiz).joinedload(Quiz.document)
        )
        .all()
    )


def get_available_prompt_questions(db: Session) -> List[QuizQuestion]:
    """Get all questions from prompt-based quizzes (globally available)"""
    from shared.models.quiz import QuizSourceType
    return (
        db.query(QuizQuestion)
        .join(Quiz, QuizQuestion.quiz_id == Quiz.id)
        .filter(Quiz.source_type == QuizSourceType.PROMPT)
        .options(
            joinedload(QuizQuestion.options),
            joinedload(QuizQuestion.quiz)
        )
        .all()
    )


def check_quiz_unlock_status(db: Session, user_id: int, quiz: CourseQuiz) -> dict:
    """Check if quiz is unlocked for user and return status info"""
    if not quiz.prerequisite_content_ids:
        # No prerequisites - always unlocked
        return {
            "is_unlocked": True,
            "missing_prerequisites": []
        }
    
    # Get user's completed content items for this course
    from shared.models import ContentItem
    from shared.models.progress import UserProgress
    
    completed_content_ids = (
        db.query(ContentItem.id)
        .join(UserProgress, ContentItem.id == UserProgress.content_id)
        .filter(
            ContentItem.course_id == quiz.course_id,
            UserProgress.user_id == user_id,
            UserProgress.completed_at.isnot(None)  # Has completion timestamp
        )
        .all()
    )
    
    completed_ids = [item[0] for item in completed_content_ids]
    missing_prerequisites = [
        req_id for req_id in quiz.prerequisite_content_ids 
        if req_id not in completed_ids
    ]
    
    return {
        "is_unlocked": len(missing_prerequisites) == 0,
        "missing_prerequisites": missing_prerequisites
    }


def get_course_quizzes_with_unlock_status(
    db: Session,
    course_id: int,
    user_id: int,
    status: Optional[QuizStatus] = None
) -> List[dict]:
    """Get course quizzes with smart status for a user — fully batched, no N+1."""
    from shared.services.quiz_status_service import calculate_quiz_status_from_data
    from shared.repos.quiz_configuration_repo import get_quiz_configs_for_course
    from shared.repos.quiz_attempt_repo import get_user_attempts_for_quizzes
    from shared.models import ContentItem
    from shared.models.progress import UserProgress

    quizzes = get_course_quizzes_by_course(db, course_id, status)
    if not quizzes:
        return []

    quiz_ids = [q.id for q in quizzes]

    # ── Batch 1: configs ──────────────────────────────────────────────────────
    configs_map = get_quiz_configs_for_course(db, quiz_ids)

    # ── Batch 2: all attempts for this user across all quizzes ────────────────
    attempts_map = get_user_attempts_for_quizzes(db, user_id, quiz_ids)

    # ── Batch 3: completed content IDs for unlock checks ─────────────────────
    completed_content_ids = set(
        row[0] for row in (
            db.query(ContentItem.id)
            .join(UserProgress, ContentItem.id == UserProgress.content_id)
            .filter(
                ContentItem.course_id == course_id,
                UserProgress.user_id == user_id,
                UserProgress.completed_at.isnot(None),
            )
            .all()
        )
    )

    quiz_list = []
    for quiz in quizzes:
        config = configs_map[quiz.id]
        attempts = attempts_map.get(quiz.id, [])

        # Compute unlock status from already-fetched data
        if quiz.prerequisite_content_ids:
            missing = [pid for pid in quiz.prerequisite_content_ids if pid not in completed_content_ids]
            is_unlocked = len(missing) == 0
        else:
            missing = []
            is_unlocked = True

        unlock_status = {"is_unlocked": is_unlocked, "missing_prerequisites": missing}

        status_info = calculate_quiz_status_from_data(quiz, config, attempts, unlock_status)

        quiz_list.append({
            "id": quiz.id,
            "title": quiz.title,
            "status": status_info["status"],
            "attempts_remaining": status_info["attempts_remaining"],
            "best_score": status_info["best_score"],
            "next_attempt_at": status_info["next_attempt_at"],
            "missing_prerequisites": status_info["missing_prerequisites"],
            "prerequisite_content_ids": quiz.prerequisite_content_ids or [],
        })

    return quiz_list