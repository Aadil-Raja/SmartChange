# SHARED: JWT token creation and verification utilities
# These functions are used across all services for authentication

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
from ..core.config import get_settings
from ..models.user import User

settings = get_settings()

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except jwt.PyJWTError:
        return None

def get_current_user(token: str) -> Optional[User]:
    """Get current user from JWT token (requires database session)"""
    payload = verify_token(token)
    if payload is None:
        return None
    
    user_id: int = payload.get("sub")
    if user_id is None:
        return None
    
    # Note: This function requires a database session to be passed
    # The actual implementation would need to query the database
    # This is a placeholder for the shared utility
    return None
