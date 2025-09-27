# APP-API SERVICE: Authentication-specific schemas
# This file contains request/response models specific to authentication in app-api

from pydantic import BaseModel
from typing import Optional
from shared.schemas.user import UserResponse

class LoginRequest(BaseModel):
    """Schema for login request"""
    username: str
    password: str

class LoginResponse(BaseModel):
    """Schema for login response"""
    access_token: str
    token_type: str
    user: UserResponse

class Token(BaseModel):
    """Schema for token response"""
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """Schema for token data"""
    username: Optional[str] = None