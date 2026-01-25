from sqlalchemy.orm import Session
from typing import Optional, List
from app.utils.response_utils import make_response
from shared.repos import course_quiz_repo
from shared.models import CourseQuiz, Course
from shared.models.course_quiz import QuizStatus
from shared.models.course_quiz_question import QuestionType


def create_course_quiz(
    db: Session,
    *,
    course_id: int,
    user_id: int,
    title: str,
    description: Optional[str] = None,
    prerequisite_content_ids: Optional[List[int]] = None
):
    """Create a new course quiz"""
    
    # Check if course exists
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        return make_response(False, "Course not found", status_code=404, error="Course does not exist")
    
    # Validate prerequisite content IDs belong to this course
    if prerequisite_content_ids:
        from shared.models import ContentItem
        valid_content_ids = (
            db.query(ContentItem.id)
            .filter(
                ContentItem.course_id == course_id,
                ContentItem.id.in_(prerequisite_content_ids)
            )
            .all()
        )
        valid_ids = [item[0] for item in valid_content_ids]
        
        if len(valid_ids) != len(prerequisite_content_ids):
            invalid_ids = set(prerequisite_content_ids) - set(valid_ids)
            return make_response(
                False, 
                "Invalid prerequisite content IDs", 
                status_code=400, 
                error=f"Content items {list(invalid_ids)} do not exist in this course"
            )
    
    # Create course quiz with course_id
    quiz = course_quiz_repo.create_course_quiz(
        db,
        course_id=course_id,
        title=title,
        created_by=user_id,
        description=description,
        prerequisite_content_ids=prerequisite_content_ids,
        status=QuizStatus.DRAFT
    )
    
    # Serialize quiz
    quiz_data = {
        "id": quiz.id,
        "course_id": quiz.course_id,
        "title": quiz.title,
        "description": quiz.description,
        "total_questions": quiz.total_questions,
        "prerequisite_content_ids": quiz.prerequisite_content_ids,
        "status": quiz.status.value if hasattr(quiz.status, 'value') else quiz.status,
        "created_by": quiz.created_by,
        "created_at": quiz.created_at,
        "updated_at": quiz.updated_at,
        "published_at": quiz.published_at
    }
    
    return make_response(True, "Course quiz created", data=quiz_data, status_code=201)


def get_course_quiz(db: Session, *, quiz_id: int, user_id: int):
    """Get course quiz with all questions and options"""
    quiz = course_quiz_repo.get_course_quiz_with_questions(db, quiz_id)
    if not quiz:
        return make_response(False, "Course quiz not found", status_code=404, error="Course quiz does not exist")
    
    # Serialize quiz with questions and options
    quiz_data = {
        "id": quiz.id,
        "course_id": quiz.course_id,
        "title": quiz.title,
        "description": quiz.description,
        "total_questions": quiz.total_questions,
        "status": quiz.status.value if hasattr(quiz.status, 'value') else quiz.status,
        "created_by": quiz.created_by,
        "created_at": quiz.created_at,
        "updated_at": quiz.updated_at,
        "published_at": quiz.published_at,
        "questions": []
    }
    
    for question in quiz.questions:
        if question.question_type == QuestionType.REFERENCED:
            # Get data from referenced document question
            doc_question = question.source_document_question
            question_data = {
                "id": question.id,
                "course_quiz_id": question.course_quiz_id,
                "question_type": question.question_type.value,
                "question_order": question.question_order,
                "question_text": doc_question.question_text,
                "correct_answer_index": doc_question.correct_answer_index,
                "explanation": doc_question.explanation,
                "source_document_question_id": question.source_document_question_id,
                "created_at": question.created_at,
                "updated_at": question.updated_at,
                "options": [
                    {
                        "id": opt.id,
                        "option_text": opt.option_text,
                        "option_order": opt.option_order
                    }
                    for opt in doc_question.options
                ]
            }
        else:
            # Get data from course-specific question detail
            detail = question.course_question_detail
            question_data = {
                "id": question.id,
                "course_quiz_id": question.course_quiz_id,
                "question_type": question.question_type.value,
                "question_order": question.question_order,
                "question_text": detail.question_text,
                "correct_answer_index": detail.correct_answer_index,
                "explanation": detail.explanation,
                "course_question_detail_id": question.course_question_detail_id,
                "created_at": question.created_at,
                "updated_at": question.updated_at,
                "options": [
                    {
                        "id": opt.id,
                        "option_text": opt.option_text,
                        "option_order": opt.option_order
                    }
                    for opt in detail.options
                ]
            }
        
        quiz_data["questions"].append(question_data)
    
    return make_response(True, "Course quiz retrieved", data=quiz_data)


def list_course_quizzes(db: Session, *, course_id: int, user_id: int):
    """List all quizzes for a course"""
    quizzes = course_quiz_repo.get_course_quizzes_by_course(db, course_id)
    
    # Serialize quizzes
    quiz_list = []
    for quiz in quizzes:
        quiz_list.append({
            "id": quiz.id,
            "course_id": quiz.course_id,
            "title": quiz.title,
            "description": quiz.description,
            "total_questions": quiz.total_questions,
            "status": quiz.status.value if hasattr(quiz.status, 'value') else quiz.status,
            "created_by": quiz.created_by,
            "created_at": quiz.created_at,
            "updated_at": quiz.updated_at,
            "published_at": quiz.published_at
        })
    
    return make_response(True, "Course quizzes retrieved", data={"quizzes": quiz_list, "total": len(quiz_list)})


def update_course_quiz(
    db: Session,
    *,
    quiz_id: int,
    user_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    prerequisite_content_ids: Optional[List[int]] = None
):
    """Update course quiz metadata"""
    quiz = course_quiz_repo.get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Course quiz not found", status_code=404, error="Course quiz does not exist")
    
    # Check if user created the quiz
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can edit", status_code=403, error="User is not the quiz creator")
    
    # Validate prerequisite content IDs if provided
    if prerequisite_content_ids is not None:
        from shared.models import ContentItem
        valid_content_ids = (
            db.query(ContentItem.id)
            .filter(
                ContentItem.course_id == quiz.course_id,
                ContentItem.id.in_(prerequisite_content_ids)
            )
            .all()
        )
        valid_ids = [item[0] for item in valid_content_ids]
        
        if len(valid_ids) != len(prerequisite_content_ids):
            invalid_ids = set(prerequisite_content_ids) - set(valid_ids)
            return make_response(
                False, 
                "Invalid prerequisite content IDs", 
                status_code=400, 
                error=f"Content items {list(invalid_ids)} do not exist in this course"
            )
    
    updated_quiz = course_quiz_repo.update_course_quiz(
        db, 
        quiz_id, 
        title=title, 
        description=description,
        prerequisite_content_ids=prerequisite_content_ids
    )
    
    # Serialize the updated quiz
    quiz_data = {
        "id": updated_quiz.id,
        "course_id": updated_quiz.course_id,
        "title": updated_quiz.title,
        "description": updated_quiz.description,
        "total_questions": updated_quiz.total_questions,
        "prerequisite_content_ids": updated_quiz.prerequisite_content_ids,
        "status": updated_quiz.status.value if hasattr(updated_quiz.status, 'value') else updated_quiz.status,
        "created_by": updated_quiz.created_by,
        "created_at": updated_quiz.created_at,
        "updated_at": updated_quiz.updated_at,
        "published_at": updated_quiz.published_at
    }
    
    return make_response(True, "Course quiz updated", data=quiz_data)


def publish_course_quiz(db: Session, *, quiz_id: int, user_id: int):
    """Publish a course quiz (make it visible to employees)"""
    quiz = course_quiz_repo.get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Course quiz not found", status_code=404, error="Course quiz does not exist")
    
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can publish", status_code=403, error="User is not the quiz creator")
    
    if quiz.total_questions == 0:
        return make_response(False, "Cannot publish quiz with no questions", status_code=400, error="Quiz has no questions")
    
    updated_quiz = course_quiz_repo.publish_course_quiz(db, quiz_id)
    
    # Serialize the updated quiz
    quiz_data = {
        "id": updated_quiz.id,
        "course_id": updated_quiz.course_id,
        "title": updated_quiz.title,
        "description": updated_quiz.description,
        "total_questions": updated_quiz.total_questions,
        "status": updated_quiz.status.value if hasattr(updated_quiz.status, 'value') else updated_quiz.status,
        "created_by": updated_quiz.created_by,
        "created_at": updated_quiz.created_at,
        "updated_at": updated_quiz.updated_at,
        "published_at": updated_quiz.published_at
    }
    
    return make_response(True, "Course quiz published", data=quiz_data)


def delete_course_quiz(db: Session, *, quiz_id: int, user_id: int):
    """Delete a course quiz"""
    quiz = course_quiz_repo.get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Course quiz not found", status_code=404, error="Course quiz does not exist")
    
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can delete", status_code=403, error="User is not the quiz creator")
    
    course_quiz_repo.delete_course_quiz(db, quiz_id)
    return make_response(True, "Course quiz deleted", status_code=200)


# ============ Question Management ============
def add_referenced_question(
    db: Session,
    *,
    quiz_id: int,
    user_id: int,
    source_document_question_id: int
):
    """Add a referenced question from document quiz"""
    quiz = course_quiz_repo.get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Course quiz not found", status_code=404, error="Course quiz does not exist")
    
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can add questions", status_code=403, error="User is not the quiz creator")
    
    # Get next question order
    question_order = quiz.total_questions
    
    question = course_quiz_repo.create_referenced_question(
        db,
        course_quiz_id=quiz_id,
        source_document_question_id=source_document_question_id,
        question_order=question_order
    )
    
    # Update total count
    course_quiz_repo.update_total_questions(db, quiz_id)
    
    # Serialize the question
    doc_question = question.source_document_question
    question_data = {
        "id": question.id,
        "course_quiz_id": question.course_quiz_id,
        "question_type": question.question_type.value,
        "question_order": question.question_order,
        "question_text": doc_question.question_text,
        "correct_answer_index": doc_question.correct_answer_index,
        "explanation": doc_question.explanation,
        "source_document_question_id": question.source_document_question_id,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
        "options": [
            {
                "id": opt.id,
                "option_text": opt.option_text,
                "option_order": opt.option_order
            }
            for opt in doc_question.options
        ]
    }
    
    return make_response(True, "Referenced question added", data=question_data, status_code=201)


def add_course_specific_question(
    db: Session,
    *,
    quiz_id: int,
    user_id: int,
    question_text: str,
    correct_answer_index: int,
    options: List[dict],
    explanation: Optional[str] = None
):
    """Add a course-specific question"""
    quiz = course_quiz_repo.get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Course quiz not found", status_code=404, error="Course quiz does not exist")
    
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can add questions", status_code=403, error="User is not the quiz creator")
    
    # Get next question order
    question_order = quiz.total_questions
    
    question = course_quiz_repo.create_course_specific_question(
        db,
        course_quiz_id=quiz_id,
        question_text=question_text,
        correct_answer_index=correct_answer_index,
        question_order=question_order,
        options=options,
        explanation=explanation
    )
    
    # Update total count
    course_quiz_repo.update_total_questions(db, quiz_id)
    
    # Serialize the question
    detail = question.course_question_detail
    question_data = {
        "id": question.id,
        "course_quiz_id": question.course_quiz_id,
        "question_type": question.question_type.value,
        "question_order": question.question_order,
        "question_text": detail.question_text,
        "correct_answer_index": detail.correct_answer_index,
        "explanation": detail.explanation,
        "course_question_detail_id": question.course_question_detail_id,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
        "options": [
            {
                "id": opt.id,
                "option_text": opt.option_text,
                "option_order": opt.option_order
            }
            for opt in detail.options
        ]
    }
    
    return make_response(True, "Course-specific question added", data=question_data, status_code=201)


def update_course_question(
    db: Session,
    *,
    question_id: int,
    user_id: int,
    question_text: Optional[str] = None,
    correct_answer_index: Optional[int] = None,
    explanation: Optional[str] = None,
    options: Optional[List[dict]] = None
):
    """Update any course quiz question - auto-converts REFERENCED to COURSE_SPECIFIC when edited"""
    question = course_quiz_repo.get_course_quiz_question_by_id(db, question_id)
    if not question:
        return make_response(False, "Question not found", status_code=404, error="Question does not exist")
    
    quiz = course_quiz_repo.get_course_quiz_by_id(db, question.course_quiz_id)
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can edit questions", status_code=403, error="User is not the quiz creator")
    
    # Auto-convert REFERENCED to COURSE_SPECIFIC when edited
    if question.question_type == QuestionType.REFERENCED:
        # Convert to course-specific with new data
        updated_question = course_quiz_repo.convert_to_course_specific(
            db,
            question_id=question_id,
            question_text=question_text,
            correct_answer_index=correct_answer_index,
            options=options or [],
            explanation=explanation
        )
    else:
        # Update existing course-specific question
        updated_question = course_quiz_repo.update_course_specific_question(
            db,
            question_id=question_id,
            question_text=question_text,
            correct_answer_index=correct_answer_index,
            explanation=explanation,
            options=options
        )
    
    # Serialize the updated question
    detail = updated_question.course_question_detail
    question_data = {
        "id": updated_question.id,
        "course_quiz_id": updated_question.course_quiz_id,
        "question_type": updated_question.question_type.value,
        "question_order": updated_question.question_order,
        "question_text": detail.question_text,
        "correct_answer_index": detail.correct_answer_index,
        "explanation": detail.explanation,
        "course_question_detail_id": updated_question.course_question_detail_id,
        "created_at": updated_question.created_at,
        "updated_at": updated_question.updated_at,
        "options": [
            {
                "id": opt.id,
                "option_text": opt.option_text,
                "option_order": opt.option_order
            }
            for opt in detail.options
        ]
    }
    
    return make_response(True, "Question updated", data=question_data)


def delete_course_question(db: Session, *, question_id: int, user_id: int):
    """Delete a course quiz question"""
    question = course_quiz_repo.get_course_quiz_question_by_id(db, question_id)
    if not question:
        return make_response(False, "Question not found", status_code=404, error="Question does not exist")
    
    quiz = course_quiz_repo.get_course_quiz_by_id(db, question.course_quiz_id)
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can delete questions", status_code=403, error="User is not the quiz creator")
    
    course_quiz_repo.delete_course_quiz_question(db, question_id)
    return make_response(True, "Question deleted", status_code=200)


def get_available_questions(db: Session, *, course_id: int, user_id: int):
    """Get available document questions for a course"""
    questions = course_quiz_repo.get_available_document_questions(db, course_id)
    
    # Serialize questions
    question_list = []
    for question in questions:
        question_data = {
            "id": question.id,
            "quiz_id": question.quiz_id,
            "question_text": question.question_text,
            "correct_answer_index": question.correct_answer_index,
            "explanation": question.explanation,
            "options": [
                {
                    "id": opt.id,
                    "option_text": opt.option_text,
                    "option_order": opt.option_order
                }
                for opt in question.options
            ]
        }
        question_list.append(question_data)
    
    return make_response(True, "Available questions retrieved", data={"questions": question_list, "total": len(question_list)})