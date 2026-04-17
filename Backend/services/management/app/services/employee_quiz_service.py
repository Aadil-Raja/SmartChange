from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from app.utils.response_utils import make_response
from shared.repos import course_quiz_repo, quiz_attempt_repo, quiz_configuration_repo
from shared.models.course_quiz import QuizStatus
from shared.models.course_quiz_question import QuestionType
from shared.services.quiz_status_service import calculate_quiz_status


def get_quiz_for_taking(db: Session, *, quiz_id: int, user_id: int):
    """Get quiz for employee to take - no answers or explanations exposed"""
    
    # Get quiz with questions
    quiz = course_quiz_repo.get_course_quiz_with_questions(db, quiz_id)
    if not quiz:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    # Check quiz status - must be "can_take" or passed with retakes remaining
    status_info = calculate_quiz_status(db, user_id, quiz)
    allowed = status_info["status"] == "can_take" or (status_info["status"] == "completed" and status_info.get("can_retake"))
    if not allowed:
        if status_info["status"] == "locked":
            return make_response(False, "Quiz is locked", status_code=403, error=status_info["reason"])
        elif status_info["status"] == "completed":
            return make_response(False, "No attempts remaining", status_code=403, error="You have used all attempts for this quiz")
        elif status_info["status"] in ("in_cooldown", "cooldown"):
            return make_response(False, "Quiz in cooldown period", status_code=403, error=f"Must wait until {status_info['next_attempt_at']} before next attempt")
        elif status_info["status"] == "max_attempts_reached":
            return make_response(False, "Maximum attempts reached", status_code=403, error=f"You have used all {status_info['attempts_used']} attempts for this quiz")
        else:
            return make_response(False, "Quiz not available", status_code=403, error=status_info["reason"])
    
    # Get current attempt number for UI display
    attempts = quiz_attempt_repo.get_user_quiz_attempts(db, user_id, quiz.id)
    attempt_number = len(attempts) + 1
    
    # Get max attempts from configuration
    config = quiz_configuration_repo.get_quiz_config(db, quiz.id)
    
    # Serialize quiz for employee (NO answers or explanations)
    quiz_data = {
        "id": quiz.id,
        "course_id": quiz.course_id,
        "title": quiz.title,
        "questions": [],
        "attempt_number": attempt_number,
        "max_attempts": config["max_attempts"]
    }
    
    # Process questions - hide answers and explanations
    for question in quiz.questions:
        if question.question_type == QuestionType.REFERENCED:
            # Get data from referenced document question
            doc_question = question.source_document_question
            question_data = {
                "id": question.id,
                "question_text": doc_question.question_text,
                "question_order": question.question_order,
                "options": [
                    {
                        "id": opt.id,
                        "option_text": opt.option_text,
                        "option_order": opt.option_order
                        # NO correct answer indication
                    }
                    for opt in doc_question.options
                ]
            }
        else:
            # Get data from course-specific question detail
            detail = question.course_question_detail
            question_data = {
                "id": question.id,
                "question_text": detail.question_text,
                "question_order": question.question_order,
                "options": [
                    {
                        "id": opt.id,
                        "option_text": opt.option_text,
                        "option_order": opt.option_order
                        # NO correct answer indication
                    }
                    for opt in detail.options
                ]
            }
        
        quiz_data["questions"].append(question_data)
    
    return make_response(True, "Quiz loaded for taking", data=quiz_data)


def validate_quiz_access(db: Session, quiz_id: int, user_id: int):
    """Validate that user can access this quiz"""
    quiz = course_quiz_repo.get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        raise ValueError("Quiz not found")
    
    if quiz.status != QuizStatus.PUBLISHED:
        raise ValueError("Quiz not published")
    
    unlock_status = course_quiz_repo.check_quiz_unlock_status(db, user_id, quiz)
    if not unlock_status["is_unlocked"]:
        raise ValueError(f"Quiz locked - complete items {unlock_status['missing_prerequisites']}")
    
    return quiz


def submit_quiz_attempt(db: Session, *, quiz_id: int, user_id: int, answers: Dict[str, int]):
    """Submit quiz attempt and return results with explanations"""
    
    # Get quiz
    quiz = course_quiz_repo.get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    # Check quiz status - must be "can_take"
    status_info = calculate_quiz_status(db, user_id, quiz)
    allowed = status_info["status"] == "can_take" or (status_info["status"] == "completed" and status_info.get("can_retake"))
    if not allowed:
        return make_response(False, f"Cannot take quiz: {status_info['reason']}", status_code=403, error=status_info["reason"])
    
    # Get quiz with questions for scoring
    quiz_with_questions = course_quiz_repo.get_course_quiz_with_questions(db, quiz_id)
    if not quiz_with_questions:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    # Calculate score
    score_data = calculate_quiz_score(quiz_with_questions, answers)
    
    # Save attempt to database
    attempt = quiz_attempt_repo.create_quiz_attempt(
        db,
        user_id=user_id,
        quiz_id=quiz_id,
        answers=answers,
        score=score_data["score"],
        total_questions=score_data["total_questions"],
        percentage=score_data["percentage"],
        passed=score_data["passed"]
    )

    # Auto-complete course if all content done AND all quizzes passed or exhausted
    try:
        course_id = quiz.course_id
        from app.repositories.course_enrollment_repo import get_enrollment, mark_course_completed
        from app.repositories import courseContent_repo as content_repo
        from app.repositories import progress_repo as prog_repo
        from shared.repos.course_quiz_repo import get_course_quizzes_by_course
        from shared.models.course_quiz import QuizStatus as CQStatus
        from shared.repos import quiz_attempt_repo as qa_repo

        enrollment = get_enrollment(db, user_id=user_id, course_id=course_id)
        if enrollment and not enrollment.completed_at:
            # Check all content items completed
            items = content_repo.list_items_for_course(db, course_id=course_id)
            content_ids = [i.id for i in items]
            if content_ids:
                rows = prog_repo.list_for_user_and_content_ids(db, user_id=user_id, content_ids=content_ids)
                done_ids = {r.content_id for r in rows if r.completed_at is not None or (r.progress or 0) >= 100.0}
                all_content_done = done_ids >= set(content_ids)
            else:
                all_content_done = True

            # Check all published quizzes passed or attempts exhausted
            published_quizzes = get_course_quizzes_by_course(db, course_id, CQStatus.PUBLISHED)
            all_quizzes_done = True
            for q in published_quizzes:
                q_status = calculate_quiz_status(db, user_id, q)
                if q_status["status"] not in ("completed", "max_attempts_reached"):
                    all_quizzes_done = False
                    break

            if all_content_done and all_quizzes_done:
                mark_course_completed(db, user_id=user_id, course_id=course_id)
    except Exception:
        pass  # Don't fail the quiz submission if completion check errors
    
    # Get updated quiz status after this attempt
    updated_status_info = calculate_quiz_status(db, user_id, quiz)
    
    # Check if user can retake after this attempt
    attempts_after_this = len(quiz_attempt_repo.get_user_quiz_attempts(db, user_id, quiz_id))
    config = quiz_configuration_repo.get_quiz_config(db, quiz_id)
    can_retake = (score_data["percentage"] < config["passing_score"] and 
                  attempts_after_this < config["max_attempts"])

    # Build recommendation if failed
    recommendation = None
    if not score_data["passed"]:
        recommendation = _build_recommendation(db, quiz_with_questions, quiz.course_id, can_retake)

    # Decide whether to reveal correct answers and explanations:
    # - passed → always reveal
    # - failed + no retakes left → reveal (nothing to game anymore)
    # - failed + retakes remaining → hide (prevent answer memorization)
    reveal_answers = score_data["passed"] or not can_retake

    # Strip sensitive fields from results if not revealing
    question_results = score_data["question_results"]
    if not reveal_answers:
        question_results = [
            {
                "question_id": r["question_id"],
                "question_text": r["question_text"],
                "user_answer": r["user_answer"],
                "user_option_id": r["user_option_id"],
                "is_correct": r["is_correct"],
                # correct_answer, correct_option_id, explanation intentionally omitted
            }
            for r in question_results
        ]

    # Return streamlined results for learning with updated quiz status
    return make_response(
        True, 
        "Quiz submitted successfully", 
        data={
            "attempt_id": attempt.id,
            "score": score_data["score"],
            "total_questions": score_data["total_questions"],
            "percentage": score_data["percentage"],
            "passed": score_data["passed"],
            "passing_score": float(config["passing_score"]),
            "can_retake": can_retake,
            "reveal_answers": reveal_answers,
            "results": question_results,
            "recommendation": recommendation,
            # Updated quiz status after this attempt
            "quiz_status": {
                "status": updated_status_info["status"],
                "attempts_remaining": updated_status_info["attempts_remaining"],
                "best_score": updated_status_info["best_score"],
                "next_attempt_at": updated_status_info["next_attempt_at"],
                "missing_prerequisites": updated_status_info["missing_prerequisites"]
            }
        },
        status_code=201
    )


def _build_recommendation(db: Session, quiz, course_id: int, can_retake: bool) -> dict:
    """
    Build a review recommendation for a failed quiz attempt.
    - If quiz has REFERENCED questions → link to the source document
    - Otherwise → link to the course items page
    """
    message = (
        "Review the material and try again before your next attempt."
        if can_retake
        else "You've used all attempts. Review the material to strengthen your knowledge."
    )

    # Check if any question is REFERENCED (linked to a document quiz question)
    has_referenced = any(
        q.question_type == QuestionType.REFERENCED
        for q in quiz.questions
    )

    if has_referenced:
        # Trace: CourseQuizQuestion → QuizQuestion → Quiz → Document
        # Collect ALL unique documents across all referenced questions
        from shared.models.quiz_question import QuizQuestion
        from shared.models.quiz import Quiz as DocumentQuiz
        from shared.models.Document import Document

        seen_doc_ids = set()
        documents = []

        for q in quiz.questions:
            if q.question_type != QuestionType.REFERENCED:
                continue
            doc_question = q.source_document_question
            if not doc_question:
                continue
            doc_quiz = db.query(DocumentQuiz).filter(DocumentQuiz.id == doc_question.quiz_id).first()
            if not doc_quiz or not doc_quiz.document_id:
                continue
            if doc_quiz.document_id in seen_doc_ids:
                continue
            doc = db.query(Document).filter(Document.id == doc_quiz.document_id).first()
            if doc:
                seen_doc_ids.add(doc.id)
                documents.append({
                    "id": doc.id,
                    "title": doc.title,
                    "thumbnail_url": doc.cloudinary_thumbnail_url,
                })

        if documents:
            return {
                "type": "document",
                "message": message,
                "documents": documents,
                "course_id": course_id,
            }

    # Fallback: point to course items
    return {
        "type": "course",
        "message": message,
        "course_id": course_id,
    }


def calculate_quiz_score(quiz, user_answers: Dict[str, int]) -> Dict[str, Any]:
    """Calculate quiz score and generate detailed results with explanations"""
    
    total_questions = len(quiz.questions)
    correct_count = 0
    question_results = []
    
    for question in quiz.questions:
        question_id = str(question.id)
        user_answer = user_answers.get(question_id)
        
        # Get question data based on type
        if question.question_type == QuestionType.REFERENCED:
            # Get data from referenced document question
            doc_question = question.source_document_question
            question_text = doc_question.question_text
            correct_answer_index = doc_question.correct_answer_index
            explanation = doc_question.explanation
            options = [
                {
                    "option_id": opt.id,
                    "option_text": opt.option_text,
                    "option_order": opt.option_order
                }
                for opt in doc_question.options
            ]
        else:
            # Get data from course-specific question detail
            detail = question.course_question_detail
            question_text = detail.question_text
            correct_answer_index = detail.correct_answer_index
            explanation = detail.explanation
            options = [
                {
                    "option_id": opt.id,
                    "option_text": opt.option_text,
                    "option_order": opt.option_order
                }
                for opt in detail.options
            ]
        
        # Check if answer is correct
        is_correct = user_answer == correct_answer_index
        if is_correct:
            correct_count += 1
        
        # Get option IDs for display
        user_option_id = None
        correct_option_id = None
        
        for opt in options:
            if opt["option_order"] == user_answer:
                user_answer_text = opt["option_text"]
                user_option_id = opt.get("option_id")  # Get option ID
            if opt["option_order"] == correct_answer_index:
                correct_answer_text = opt["option_text"]
                correct_option_id = opt.get("option_id")  # Get option ID
        
        question_results.append({
            "question_id": question.id,
            "question_text": question_text,
            "user_answer": user_answer_text or "No answer selected",
            "user_option_id": user_option_id,
            "correct_answer": correct_answer_text,
            "correct_option_id": correct_option_id,
            "is_correct": is_correct,
            "explanation": explanation
        })
    
    # Calculate percentage and pass status
    percentage = round((correct_count / total_questions) * 100, 2) if total_questions > 0 else 0
    passed = percentage >= 70.0  # 70% pass threshold (configurable)
    
    return {
        "score": correct_count,
        "total_questions": total_questions,
        "percentage": percentage,
        "passed": passed,
        "question_results": question_results
    }



