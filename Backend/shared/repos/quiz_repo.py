from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional
from shared.models import Quiz, QuizQuestion, QuizOption, QuizStatus
from shared.models.quiz import QuizSourceType


# ============ Quiz CRUD ============
def create_quiz(
    db: Session,
    title: str,
    created_by: int,
    document_id: Optional[int] = None,
    description: Optional[str] = None,
    status: QuizStatus = QuizStatus.DRAFT,
    source_type: QuizSourceType = QuizSourceType.DOCUMENT,
    prompt_text: Optional[str] = None,
) -> Quiz:
    """Create a new quiz (document-based or prompt-based)"""
    quiz = Quiz(
        document_id=document_id,
        title=title,
        description=description,
        created_by=created_by,
        status=status,
        source_type=source_type,
        prompt_text=prompt_text,
        total_questions=0
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


def get_quiz_by_id(db: Session, quiz_id: int) -> Optional[Quiz]:
    """Get quiz by ID without questions"""
    return db.query(Quiz).filter(Quiz.id == quiz_id).first()


def get_quiz_with_questions(db: Session, quiz_id: int) -> Optional[Quiz]:
    """Get quiz with all questions and options"""
    return (
        db.query(Quiz)
        .options(
            joinedload(Quiz.questions).joinedload(QuizQuestion.options)
        )
        .filter(Quiz.id == quiz_id)
        .first()
    )


def get_quizzes_by_document(
    db: Session,
    document_id: int,
    status: Optional[QuizStatus] = None
) -> List[Quiz]:
    """Get all quizzes for a document"""
    query = db.query(Quiz).filter(Quiz.document_id == document_id)
    if status:
        query = query.filter(Quiz.status == status)
    return query.order_by(Quiz.created_at.desc()).all()


def get_all_quizzes_by_user(db: Session, user_id: int) -> List[Quiz]:
    """Get all quizzes created by a user"""
    return db.query(Quiz).filter(Quiz.created_by == user_id).order_by(Quiz.created_at.desc()).all()


def get_all_prompt_quizzes(db: Session) -> List[Quiz]:
    """Get all prompt-based quizzes"""
    return (
        db.query(Quiz)
        .filter(Quiz.source_type == QuizSourceType.PROMPT)
        .order_by(Quiz.created_at.desc())
        .all()
    )


def get_prompt_quiz_with_questions(db: Session, quiz_id: int) -> Optional[Quiz]:
    """Get a prompt quiz with all questions and options"""
    return (
        db.query(Quiz)
        .options(joinedload(Quiz.questions).joinedload(QuizQuestion.options))
        .filter(Quiz.id == quiz_id, Quiz.source_type == QuizSourceType.PROMPT)
        .first()
    )


def update_quiz(
    db: Session,
    quiz_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[QuizStatus] = None
) -> Optional[Quiz]:
    """Update quiz metadata"""
    quiz = get_quiz_by_id(db, quiz_id)
    if not quiz:
        return None
    
    if title is not None:
        quiz.title = title
    if description is not None:
        quiz.description = description
    if status is not None:
        quiz.status = status
    
    db.commit()
    db.refresh(quiz)
    return quiz


def update_quiz_status(db: Session, quiz_id: int, status: QuizStatus) -> Optional[Quiz]:
    """Update quiz status"""
    return update_quiz(db, quiz_id, status=status)


def delete_quiz(db: Session, quiz_id: int) -> bool:
    """Delete a quiz (cascades to questions and options)"""
    quiz = get_quiz_by_id(db, quiz_id)
    if not quiz:
        return False
    db.delete(quiz)
    db.commit()
    return True


def get_course_quiz_references_for_quiz(db: Session, quiz_id: int) -> int:
    """Count how many CourseQuizQuestions actively reference any question from this quiz"""
    from shared.models.course_quiz_question import CourseQuizQuestion, QuestionType
    return (
        db.query(CourseQuizQuestion)
        .join(QuizQuestion, CourseQuizQuestion.source_document_question_id == QuizQuestion.id)
        .filter(
            QuizQuestion.quiz_id == quiz_id,
            CourseQuizQuestion.question_type == QuestionType.REFERENCED
        )
        .count()
    )


def get_course_quiz_references_for_question(db: Session, question_id: int) -> int:
    """Count how many CourseQuizQuestions actively reference this specific question"""
    from shared.models.course_quiz_question import CourseQuizQuestion, QuestionType
    return (
        db.query(CourseQuizQuestion)
        .filter(
            CourseQuizQuestion.source_document_question_id == question_id,
            CourseQuizQuestion.question_type == QuestionType.REFERENCED
        )
        .count()
    )


def update_total_questions(db: Session, quiz_id: int) -> Optional[Quiz]:
    """Recalculate and update total_questions count"""
    quiz = get_quiz_by_id(db, quiz_id)
    if not quiz:
        return None
    
    count = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).count()
    quiz.total_questions = count
    db.commit()
    db.refresh(quiz)
    return quiz


# ============ Question CRUD ============
def create_question(
    db: Session,
    quiz_id: int,
    question_text: str,
    correct_answer_index: int,
    question_order: int,
    explanation: Optional[str] = None
) -> QuizQuestion:
    """Create a new question"""
    question = QuizQuestion(
        quiz_id=quiz_id,
        question_text=question_text,
        correct_answer_index=correct_answer_index,
        question_order=question_order,
        explanation=explanation
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def get_question_by_id(db: Session, question_id: int) -> Optional[QuizQuestion]:
    """Get question with options"""
    return (
        db.query(QuizQuestion)
        .options(joinedload(QuizQuestion.options))
        .filter(QuizQuestion.id == question_id)
        .first()
    )


def update_question(
    db: Session,
    question_id: int,
    question_text: Optional[str] = None,
    correct_answer_index: Optional[int] = None,
    explanation: Optional[str] = None
) -> Optional[QuizQuestion]:
    """Update question"""
    question = get_question_by_id(db, question_id)
    if not question:
        return None
    
    if question_text is not None:
        question.question_text = question_text
    if correct_answer_index is not None:
        question.correct_answer_index = correct_answer_index
    if explanation is not None:
        question.explanation = explanation
    
    db.commit()
    db.refresh(question)
    return question


def delete_question(db: Session, question_id: int) -> bool:
    """Delete a question (cascades to options)"""
    question = get_question_by_id(db, question_id)
    if not question:
        return False
    
    quiz_id = question.quiz_id
    db.delete(question)
    db.commit()
    
    # Update total_questions count
    update_total_questions(db, quiz_id)
    return True


# ============ Option CRUD ============
def create_option(
    db: Session,
    question_id: int,
    option_text: str,
    option_order: int
) -> QuizOption:
    """Create a new option"""
    option = QuizOption(
        question_id=question_id,
        option_text=option_text,
        option_order=option_order
    )
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


def delete_options_by_question(db: Session, question_id: int) -> int:
    """Delete all options for a question"""
    count = db.query(QuizOption).filter(QuizOption.question_id == question_id).delete()
    db.commit()
    return count


# ============ Bulk Operations ============
def create_question_with_options(
    db: Session,
    quiz_id: int,
    question_text: str,
    correct_answer_index: int,
    question_order: int,
    options: List[dict],
    explanation: Optional[str] = None
) -> QuizQuestion:
    """Create a question with its options in one transaction"""
    question = create_question(
        db, quiz_id, question_text, correct_answer_index, question_order, explanation
    )
    
    for opt in options:
        create_option(db, question.id, opt["option_text"], opt["option_order"])
    
    # Refresh to load options
    db.refresh(question)
    return question


def update_question_with_options(
    db: Session,
    question_id: int,
    question_text: Optional[str] = None,
    correct_answer_index: Optional[int] = None,
    explanation: Optional[str] = None,
    options: Optional[List[dict]] = None
) -> Optional[QuizQuestion]:
    """Update question and optionally replace all options"""
    question = update_question(db, question_id, question_text, correct_answer_index, explanation)
    if not question:
        return None
    
    if options is not None:
        # Delete old options and create new ones
        delete_options_by_question(db, question_id)
        for opt in options:
            create_option(db, question_id, opt["option_text"], opt["option_order"])
    
    db.refresh(question)
    return question
