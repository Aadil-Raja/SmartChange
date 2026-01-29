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
    
    # Check quiz status - must be "can_take" to access quiz questions
    status_info = calculate_quiz_status(db, user_id, quiz)
    if status_info["status"] != "can_take":
        # Return appropriate error based on status
        if status_info["status"] == "locked":
            return make_response(
                False, 
                "Quiz is locked", 
                status_code=403, 
                error=status_info["reason"]
            )
        elif status_info["status"] == "completed":
            return make_response(
                False, 
                "Quiz already completed", 
                status_code=403, 
                error=f"You have already passed this quiz with {status_info['best_score']}%"
            )
        elif status_info["status"] == "in_cooldown":
            return make_response(
                False, 
                "Quiz in cooldown period", 
                status_code=403, 
                error=f"Must wait until {status_info['next_attempt_at']} before next attempt"
            )
        elif status_info["status"] == "max_attempts_reached":
            return make_response(
                False, 
                "Maximum attempts reached", 
                status_code=403, 
                error=f"You have used all {status_info['attempts_used']} attempts for this quiz"
            )
        else:
            return make_response(
                False, 
                "Quiz not available", 
                status_code=403, 
                error=status_info["reason"]
            )
    
    # Get current attempt number for UI display
    attempts = quiz_attempt_repo.get_user_quiz_attempts(db, user_id, quiz.id)
    attempt_number = len(attempts) + 1
    
    # Get max attempts from configuration
    config = quiz_configuration_repo.get_quiz_config(db, quiz.id)
    
    # Serialize quiz for employee (NO answers or explanations)
    quiz_data = {
        "id": quiz.id,
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


def get_attempt_results(db: Session, *, quiz_id: int, attempt_id: int, user_id: int):
    """Get detailed results for a specific quiz attempt"""
    
    # Get the attempt
    attempt = quiz_attempt_repo.get_quiz_attempt_by_id(db, attempt_id)
    if not attempt:
        return make_response(False, "Attempt not found", status_code=404, error="Quiz attempt does not exist")
    
    # Verify ownership
    if attempt.user_id != user_id or attempt.quiz_id != quiz_id:
        return make_response(False, "Access denied", status_code=403, error="You can only view your own attempts")
    
    # Get quiz with questions for detailed results
    quiz_with_questions = course_quiz_repo.get_course_quiz_with_questions(db, quiz_id)
    if not quiz_with_questions:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    # Reconstruct detailed results from stored answers
    score_data = calculate_quiz_score(quiz_with_questions, attempt.answers)
    
    return make_response(
        True,
        "Attempt results retrieved",
        data={
            "attempt_id": attempt.id,
            "quiz_title": quiz_with_questions.title,
            "score": attempt.score,
            "total_questions": attempt.total_questions,
            "percentage": float(attempt.percentage),
            "passed": attempt.passed,
            "completed_at": attempt.completed_at,
            "results": score_data["question_results"]
        }
    )


def submit_quiz_attempt(db: Session, *, quiz_id: int, user_id: int, answers: Dict[str, int]):
    """Submit quiz attempt and return results with explanations"""
    
    # Get quiz
    quiz = course_quiz_repo.get_course_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Quiz not found", status_code=404, error="Quiz does not exist")
    
    # Check quiz status - must be "can_take"
    status_info = calculate_quiz_status(db, user_id, quiz)
    if status_info["status"] != "can_take":
        return make_response(
            False, 
            f"Cannot take quiz: {status_info['reason']}", 
            status_code=403, 
            error=status_info["reason"]
        )
    
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
    
    # Check if user can retake after this attempt
    attempts_after_this = len(quiz_attempt_repo.get_user_quiz_attempts(db, user_id, quiz_id)) + 1
    config = quiz_configuration_repo.get_quiz_config(db, quiz_id)
    can_retake = (score_data["percentage"] < config["passing_score"] and 
                  attempts_after_this < config["max_attempts"])
    
    # Return streamlined results for learning
    return make_response(
        True, 
        "Quiz submitted successfully", 
        data={
            "attempt_id": attempt.id,
            "score": score_data["score"],
            "total_questions": score_data["total_questions"],
            "percentage": score_data["percentage"],
            "passed": score_data["passed"],
            "can_retake": can_retake,
            "results": score_data["question_results"]
        },
        status_code=201
    )


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



