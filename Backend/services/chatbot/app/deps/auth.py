from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from app.core.config import get_settings
from app.deps.db import get_db

from shared.models import UserRole
from shared.repos import users_repo

settings = get_settings()


def get_current_user(token: str, db: Session = Depends(get_db)):
    """
    Dependency: verifies JWT and returns the current user (any role).
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        token_version: int = payload.get("tv", 0)
        
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate token")

    # Fetch user to validate token version
    user = users_repo.get_by_id(db, int(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Validate token version
    current_token_version = getattr(user, "token_version", 0) or 0
    if token_version != current_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token has been revoked. Please login again."
        )
  
    return user_id
