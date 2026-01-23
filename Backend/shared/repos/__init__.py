# SHARED: Repository layer for database operations
# This file exports repository modules that can be imported by any service

from . import audit_repo
from . import documents_repo
from . import quiz_repo
from . import course_quiz_repo

__all__ = [
    "audit_repo",
    "documents_repo",
    "quiz_repo",
    "course_quiz_repo",
]
