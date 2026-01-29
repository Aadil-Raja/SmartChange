from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from shared.models.quiz_configuration import QuizConfiguration

# Default configuration values
DEFAULT_QUIZ_CONFIG = {
    "max_attempts": 3,
    "passing_score": 70.0,
    "cooldown_minutes": 30
}


def get_quiz_config(db: Session, quiz_id: int) -> Dict[str, any]:
    """Get quiz configuration with fallback to defaults"""
    config = db.query(QuizConfiguration).filter(
        QuizConfiguration.quiz_id == quiz_id
    ).first()
    
    if config:
        return {
            "max_attempts": config.max_attempts,
            "passing_score": float(config.passing_score),
            "cooldown_minutes": config.cooldown_minutes
        }
    
    # Return defaults if no custom configuration exists
    return DEFAULT_QUIZ_CONFIG.copy()


def get_quiz_configs_for_course(db: Session, quiz_ids: List[int]) -> Dict[int, Dict[str, any]]:
    """Batch load quiz configurations for multiple quizzes"""
    configs = db.query(QuizConfiguration).filter(
        QuizConfiguration.quiz_id.in_(quiz_ids)
    ).all()
    
    # Create mapping of quiz_id to config
    config_map = {}
    for config in configs:
        config_map[config.quiz_id] = {
            "max_attempts": config.max_attempts,
            "passing_score": float(config.passing_score),
            "cooldown_minutes": config.cooldown_minutes
        }
    
    # Fill in defaults for quizzes without custom configs
    for quiz_id in quiz_ids:
        if quiz_id not in config_map:
            config_map[quiz_id] = DEFAULT_QUIZ_CONFIG.copy()
    
    return config_map


def create_or_update_quiz_config(
    db: Session,
    *,
    quiz_id: int,
    max_attempts: int,
    passing_score: float,
    cooldown_minutes: int,
    created_by: Optional[int] = None
) -> QuizConfiguration:
    """Create or update quiz configuration"""
    
    # Validate input ranges
    if not (1 <= max_attempts <= 10):
        raise ValueError("max_attempts must be between 1 and 10")
    if not (50.0 <= passing_score <= 100.0):
        raise ValueError("passing_score must be between 50.0 and 100.0")
    if not (0 <= cooldown_minutes <= 1440):
        raise ValueError("cooldown_minutes must be between 0 and 1440")
    
    # Check if configuration already exists
    existing_config = db.query(QuizConfiguration).filter(
        QuizConfiguration.quiz_id == quiz_id
    ).first()
    
    if existing_config:
        # Update existing configuration
        existing_config.max_attempts = max_attempts
        existing_config.passing_score = passing_score
        existing_config.cooldown_minutes = cooldown_minutes
        db.commit()
        db.refresh(existing_config)
        return existing_config
    else:
        # Create new configuration
        new_config = QuizConfiguration(
            quiz_id=quiz_id,
            max_attempts=max_attempts,
            passing_score=passing_score,
            cooldown_minutes=cooldown_minutes,
            created_by=created_by
        )
        db.add(new_config)
        db.commit()
        db.refresh(new_config)
        return new_config


def get_quiz_configuration_by_id(db: Session, config_id: int) -> Optional[QuizConfiguration]:
    """Get quiz configuration by ID"""
    return db.query(QuizConfiguration).filter(QuizConfiguration.id == config_id).first()


def delete_quiz_config(db: Session, quiz_id: int) -> bool:
    """Delete quiz configuration (revert to defaults)"""
    config = db.query(QuizConfiguration).filter(
        QuizConfiguration.quiz_id == quiz_id
    ).first()
    
    if config:
        db.delete(config)
        db.commit()
        return True
    return False