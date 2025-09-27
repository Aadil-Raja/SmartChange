# SHARED: Pydantic base schemas used across all services
# This file contains the base schemas that can be imported by any service

from .user import UserBase, UserCreate, UserUpdate, UserResponse
from .document import DocumentBase, DocumentCreate, DocumentUpdate, DocumentResponse

__all__ = [
    "UserBase", "UserCreate", "UserUpdate", "UserResponse",
    "DocumentBase", "DocumentCreate", "DocumentUpdate", "DocumentResponse"
]
