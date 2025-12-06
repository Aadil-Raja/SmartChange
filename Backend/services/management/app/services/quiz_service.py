from sqlalchemy.orm import Session
from typing import Optional
from app.utils.response_utils import make_response
from shared.repos import quiz_repo, quiz_audit_repo
from shared.models import Quiz, QuizStatus, Document, DocStatus, TeamMember, TeamMemberRole, QuizGenerationStatus
from app.services.queue.factory import get_queue
from app.core.config import get_settings

settings = get_settings()

RQ_QUIZ_TASK = "tasks.generate_quiz"  # Task name in processing_worker


def _is_team_manager(db: Session, *, team_id: int, user_id: int) -> bool:
    """Check if user is a manager of the team"""
    tm = db.query(TeamMember.role_in_team).filter_by(team_id=team_id, user_id=user_id).first()
    return bool(tm and tm[0] == TeamMemberRole.manager)


def _can_access_document(db: Session, *, document_id: int, user_id: int) -> bool:
    """Check if user can access the document (uploaded by them or in their team)"""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return False
    # For now, just check if user uploaded it
    # TODO: Add team-based access control if needed
    return doc.uploaded_by == user_id


def generate_quiz(
    db: Session,
    *,
    document_id: int,
    user_id: int,
    title: str,
    num_questions: int,
    description: Optional[str] = None
):
    """Generate quiz using LLM (enqueues background job)"""
    
    # Check if document exists and is processed
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return make_response(False, "Document not found", status_code=404, error="Document does not exist")
    
    if doc.status != DocStatus.PROCESSED:
        return make_response(
            False,
            f"Document must be processed first. Current status: {doc.status.value}",
            status_code=400,
            error="Document not processed"
        )
    
    # Check if user can access document
    if not _can_access_document(db, document_id=document_id, user_id=user_id):
        return make_response(False, "Access denied", status_code=403, error="User cannot access this document")
    
    # Create quiz record with GENERATING status
    quiz = quiz_repo.create_quiz(
        db,
        document_id=document_id,
        title=title,
        created_by=user_id,
        description=description,
        status=QuizStatus.GENERATING
    )
    
    # Enqueue background job
    try:
        q = get_queue()
        job_id = q.enqueue(
            RQ_QUIZ_TASK,
            quiz_id=quiz.id,
            document_id=document_id,
            num_questions=num_questions
        )
        
        return make_response(
            True,
            "Quiz generation started",
            data={
                "quiz_id": quiz.id,
                "job_id": job_id,
                "status": "generating"
            },
            status_code=202
        )
    except Exception as e:
        # If job enqueue fails, mark quiz as failed
        quiz_repo.update_quiz_status(db, quiz.id, QuizStatus.DRAFT)
        return make_response(False, "Failed to enqueue job", status_code=500, error=str(e))


def get_quiz(db: Session, *, quiz_id: int, user_id: int):
    """Get quiz with all questions and options"""
    quiz = quiz_repo.get_quiz_with_questions(db, quiz_id)
    if not quiz:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    # Check access
    if not _can_access_document(db, document_id=quiz.document_id, user_id=user_id):
        return make_response(False, "Access denied", status_code=403, error="User cannot access this quiz")
    
    # Serialize quiz with questions and options
    quiz_data = {
        "id": quiz.id,
        "document_id": quiz.document_id,
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
        question_data = {
            "id": question.id,
            "quiz_id": question.quiz_id,
            "question_text": question.question_text,
            "question_order": question.question_order,
            "correct_answer_index": question.correct_answer_index,
            "explanation": question.explanation,
            "created_at": question.created_at,
            "updated_at": question.updated_at,
            "options": []
        }
        
        for option in question.options:
            question_data["options"].append({
                "id": option.id,
                "option_text": option.option_text,
                "option_order": option.option_order
            })
        
        quiz_data["questions"].append(question_data)
    
    return make_response(True, "Quiz retrieved", data=quiz_data)


def list_document_quizzes(db: Session, *, document_id: int, user_id: int):
    """List all quizzes for a document"""
    if not _can_access_document(db, document_id=document_id, user_id=user_id):
        return make_response(False, "Access denied", status_code=403, error="User cannot access this document")
    
    quizzes = quiz_repo.get_quizzes_by_document(db, document_id)
    
    # Serialize quizzes to dict to avoid relationship serialization issues
    quiz_list = []
    for quiz in quizzes:
        quiz_list.append({
            "id": quiz.id,
            "document_id": quiz.document_id,
            "title": quiz.title,
            "description": quiz.description,
            "total_questions": quiz.total_questions,
            "status": quiz.status.value if hasattr(quiz.status, 'value') else quiz.status,
            "created_by": quiz.created_by,
            "created_at": quiz.created_at,
            "updated_at": quiz.updated_at,
            "published_at": quiz.published_at
        })
    
    return make_response(True, "Quizzes retrieved", data={"quizzes": quiz_list, "total": len(quiz_list)})


def update_quiz(
    db: Session,
    *,
    quiz_id: int,
    user_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None
):
    """Update quiz metadata"""
    quiz = quiz_repo.get_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    # Check if user created the quiz
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can edit", status_code=403, error="User is not the quiz creator")
    
    updated_quiz = quiz_repo.update_quiz(db, quiz_id, title=title, description=description)
    
    # Serialize the updated quiz
    quiz_data = {
        "id": updated_quiz.id,
        "document_id": updated_quiz.document_id,
        "title": updated_quiz.title,
        "description": updated_quiz.description,
        "total_questions": updated_quiz.total_questions,
        "status": updated_quiz.status.value if hasattr(updated_quiz.status, 'value') else updated_quiz.status,
        "created_by": updated_quiz.created_by,
        "created_at": updated_quiz.created_at,
        "updated_at": updated_quiz.updated_at,
        "published_at": updated_quiz.published_at
    }
    
    return make_response(True, "Quiz updated", data=quiz_data)


def publish_quiz(db: Session, *, quiz_id: int, user_id: int):
    """Publish a quiz (make it visible to employees)"""
    quiz = quiz_repo.get_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can publish", status_code=403, error="User is not the quiz creator")
    
    if quiz.total_questions == 0:
        return make_response(False, "Cannot publish quiz with no questions", status_code=400, error="Quiz has no questions")
    
    updated_quiz = quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.PUBLISHED)
    
    # Serialize the updated quiz
    quiz_data = {
        "id": updated_quiz.id,
        "document_id": updated_quiz.document_id,
        "title": updated_quiz.title,
        "description": updated_quiz.description,
        "total_questions": updated_quiz.total_questions,
        "status": updated_quiz.status.value if hasattr(updated_quiz.status, 'value') else updated_quiz.status,
        "created_by": updated_quiz.created_by,
        "created_at": updated_quiz.created_at,
        "updated_at": updated_quiz.updated_at,
        "published_at": updated_quiz.published_at
    }
    
    return make_response(True, "Quiz published", data=quiz_data)


def delete_quiz(db: Session, *, quiz_id: int, user_id: int):
    """Delete a quiz"""
    quiz = quiz_repo.get_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can delete", status_code=403, error="User is not the quiz creator")
    
    quiz_repo.delete_quiz(db, quiz_id)
    return make_response(True, "Quiz deleted", status_code=200)


# ============ Question Management ============
def add_question(
    db: Session,
    *,
    quiz_id: int,
    user_id: int,
    question_text: str,
    correct_answer_index: int,
    options: list,
    explanation: Optional[str] = None
):
    """Manually add a question to quiz"""
    quiz = quiz_repo.get_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can add questions", status_code=403, error="User is not the quiz creator")
    
    # Get next question order
    question_order = quiz.total_questions
    
    question = quiz_repo.create_question_with_options(
        db,
        quiz_id=quiz_id,
        question_text=question_text,
        correct_answer_index=correct_answer_index,
        question_order=question_order,
        options=options,
        explanation=explanation
    )
    
    # Update total count
    quiz_repo.update_total_questions(db, quiz_id)
    
    # Serialize the question with options
    question_data = {
        "id": question.id,
        "quiz_id": question.quiz_id,
        "question_text": question.question_text,
        "question_order": question.question_order,
        "correct_answer_index": question.correct_answer_index,
        "explanation": question.explanation,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
        "options": [
            {
                "id": opt.id,
                "option_text": opt.option_text,
                "option_order": opt.option_order
            }
            for opt in question.options
        ]
    }
    
    return make_response(True, "Question added", data=question_data, status_code=201)


def update_question(
    db: Session,
    *,
    question_id: int,
    user_id: int,
    question_text: Optional[str] = None,
    correct_answer_index: Optional[int] = None,
    explanation: Optional[str] = None,
    options: Optional[list] = None
):
    """Update a question"""
    question = quiz_repo.get_question_by_id(db, question_id)
    if not question:
        return make_response(False, "Question not found", status_code=404, error="Question does not exist")
    
    quiz = quiz_repo.get_quiz_by_id(db, question.quiz_id)
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can edit questions", status_code=403, error="User is not the quiz creator")
    
    updated_question = quiz_repo.update_question_with_options(
        db,
        question_id=question_id,
        question_text=question_text,
        correct_answer_index=correct_answer_index,
        explanation=explanation,
        options=options
    )
    
    # Serialize the updated question with options
    question_data = {
        "id": updated_question.id,
        "quiz_id": updated_question.quiz_id,
        "question_text": updated_question.question_text,
        "question_order": updated_question.question_order,
        "correct_answer_index": updated_question.correct_answer_index,
        "explanation": updated_question.explanation,
        "created_at": updated_question.created_at,
        "updated_at": updated_question.updated_at,
        "options": [
            {
                "id": opt.id,
                "option_text": opt.option_text,
                "option_order": opt.option_order
            }
            for opt in updated_question.options
        ]
    }
    
    return make_response(True, "Question updated", data=question_data)


def delete_question(db: Session, *, question_id: int, user_id: int):
    """Delete a question"""
    question = quiz_repo.get_question_by_id(db, question_id)
    if not question:
        return make_response(False, "Question not found", status_code=404, error="Question does not exist")
    
    quiz = quiz_repo.get_quiz_by_id(db, question.quiz_id)
    if quiz.created_by != user_id:
        return make_response(False, "Only quiz creator can delete questions", status_code=403, error="User is not the quiz creator")
    
    quiz_repo.delete_question(db, question_id)
    return make_response(True, "Question deleted", status_code=200)


# ============ Statistics ============
def get_quiz_stats(db: Session, *, user_id: int):
    """Get quiz statistics including total quizzes, published count, and per-document counts"""
    # Get all quizzes created by this user
    all_quizzes = quiz_repo.get_all_quizzes_by_user(db, user_id=user_id)
    
    # Calculate statistics
    total_quizzes = len(all_quizzes)
    published_count = sum(1 for q in all_quizzes if q.status == QuizStatus.PUBLISHED)
    draft_count = sum(1 for q in all_quizzes if q.status == QuizStatus.DRAFT)
    generating_count = sum(1 for q in all_quizzes if q.status == QuizStatus.GENERATING)
    
    # Group by document
    document_stats = {}
    for quiz in all_quizzes:
        doc_id = quiz.document_id
        if doc_id not in document_stats:
            document_stats[doc_id] = {
                "document_id": doc_id,
                "total": 0,
                "published": 0,
                "draft": 0,
                "generating": 0
            }
        
        document_stats[doc_id]["total"] += 1
        if quiz.status == QuizStatus.PUBLISHED:
            document_stats[doc_id]["published"] += 1
        elif quiz.status == QuizStatus.DRAFT:
            document_stats[doc_id]["draft"] += 1
        elif quiz.status == QuizStatus.GENERATING:
            document_stats[doc_id]["generating"] += 1
    
    stats = {
        "total_quizzes": total_quizzes,
        "published_count": published_count,
        "draft_count": draft_count,
        "generating_count": generating_count,
        "by_document": list(document_stats.values())
    }
    
    return make_response(True, "Quiz statistics retrieved", data=stats, status_code=200)



# ============ Audit Functions ============
def get_quiz_audit(db: Session, *, quiz_id: int, user_id: int):
    """Get the most recent audit record for a quiz."""
    audit = quiz_audit_repo.get_by_quiz_id(db, quiz_id)
    if not audit:
        return make_response(False, "No audit record found", status_code=404, error="Audit not found")
    
    # Serialize audit
    audit_data = {
        "id": audit.id,
        "quiz_id": audit.quiz_id,
        "document_id": audit.document_id,
        "job_id": audit.job_id,
        "status": audit.status.value,
        "current_stage": audit.current_stage.value,
        "queued_at": audit.queued_at.isoformat() if audit.queued_at else None,
        "started_at": audit.started_at.isoformat() if audit.started_at else None,
        "completed_at": audit.completed_at.isoformat() if audit.completed_at else None,
        "num_questions_requested": audit.num_questions_requested,
        "questions_created": audit.questions_created,
        "total_chunks": audit.total_chunks,
        "chunks_selected": audit.chunks_selected,
        "total_tokens": audit.total_tokens,
        "generation_metadata": audit.generation_metadata,
        "error_message": audit.error_message,
        "error_stage": audit.error_stage,
        "created_at": audit.created_at.isoformat() if audit.created_at else None,
    }
    
    # Calculate duration if completed
    if audit.started_at and audit.completed_at:
        duration = (audit.completed_at - audit.started_at).total_seconds()
        audit_data["duration_seconds"] = duration
    
    return make_response(True, "Audit record retrieved", data=audit_data, status_code=200)


def list_quiz_audits(db: Session, *, user_id: int, limit: int = 50, status: str = None):
    """List recent quiz generation audits."""
    if status:
        try:
            status_enum = QuizGenerationStatus[status.upper()]
            audits = quiz_audit_repo.list_by_status(db, status_enum)
        except KeyError:
            return make_response(False, "Invalid status", status_code=400, error=f"Status '{status}' is not valid")
    else:
        audits = quiz_audit_repo.list_recent(db, limit=limit)
    
    # Serialize audits
    audit_list = []
    for audit in audits:
        audit_data = {
            "id": audit.id,
            "quiz_id": audit.quiz_id,
            "document_id": audit.document_id,
            "job_id": audit.job_id,
            "status": audit.status.value,
            "current_stage": audit.current_stage.value,
            "queued_at": audit.queued_at.isoformat() if audit.queued_at else None,
            "started_at": audit.started_at.isoformat() if audit.started_at else None,
            "completed_at": audit.completed_at.isoformat() if audit.completed_at else None,
            "num_questions_requested": audit.num_questions_requested,
            "questions_created": audit.questions_created,
            "total_chunks": audit.total_chunks,
            "chunks_selected": audit.chunks_selected,
            "total_tokens": audit.total_tokens,
            "error_message": audit.error_message,
            "error_stage": audit.error_stage,
            "created_at": audit.created_at.isoformat() if audit.created_at else None,
        }
        
        # Calculate duration if completed
        if audit.started_at and audit.completed_at:
            duration = (audit.completed_at - audit.started_at).total_seconds()
            audit_data["duration_seconds"] = duration
        
        # Add quiz title if available
        if audit.quiz:
            audit_data["quiz_title"] = audit.quiz.title
        
        # Add document title if available
        if audit.document:
            audit_data["document_title"] = audit.document.title
        
        audit_list.append(audit_data)
    
    return make_response(
        True, 
        "Audit records retrieved", 
        data={"audits": audit_list, "total": len(audit_list)}, 
        status_code=200
    )
