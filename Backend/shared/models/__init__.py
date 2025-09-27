# SHARED: SQLAlchemy ORM models used across all services
# This file contains the base database models that can be imported by any service

from .user import User
from .document import Document

__all__ = ["User", "Document"]
