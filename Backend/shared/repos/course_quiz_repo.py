from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional
from shared.models import (
    CourseQuiz, CourseQuizQuestion, CourseQuestionDetail, CourseQuestionOption, 
    QuizStatus, QuestionType, Quiz, QuizQuestion
)


# ============ Course Quiz CRUD ============
def create_course_quiz(
    db: Session,
    course_id: int,
    title: str,
    created_by: int,
    description: Optional[str] = None,
    status: QuizStatus = QuizStatus.DRAFT
) -> CourseQuiz:
    """Create a new course quiz"""
    quiz = CourseQuiz(
        course_id=course_id,
        title=title,
        description=description,
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
    """Get all quizzes for a course"""
    query = db.query(CourseQuiz).filter(CourseQuiz.course_id == course_id)
    if status:
        query = query.filter(CourseQuiz.status == status)
    return query.order_by(CourseQuiz.created_at.desc()).all()


def get_all_course_quizzes_by_user(db: Session, user_id: int) -> List[CourseQuiz]:
    """Get all course quizzes created by a user"""
    return db.query(CourseQuiz).filter(CourseQuiz.created_by == user_id).order_by(CourseQuiz.created_at.desc()).all()


def update_course_quiz(
    db: Session,
    quiz_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
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
    if status is not None:
        quiz.status = status
    
    db.commit()
    db.refresh(quiz)
    return quiz


def update_course_quiz_status(db: Session, quiz_id: int, status: QuizStatus) -> Optional[CourseQuiz]:
    """Update course quiz status"""
    return update_course_quiz(db, quiz_id, status=status)


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
    question_text: str,
    correct_answer_index: int,
    options: List[dict],
    explanation: Optional[str] = None
) -> Optional[CourseQuizQuestion]:
    """Convert a referenced question to course-specific"""
    question = get_course_quiz_question_by_id(db, question_id)
    if not question or question.question_type != QuestionType.REFERENCED:
        return None
    
    # Create question detail
    detail = CourseQuestionDetail(
        question_text=question_text,
        correct_answer_index=correct_answer_index,
        explanation=explanation
    )
    db.add(detail)
    db.flush()
    
    # Create options
    for opt in options:
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
    # This would need to join through course content to find documents in the course
    # For now, returning empty list - implement based on your course-document relationship
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
        .options(joinedload(QuizQuestion.options))
        .all()
    )