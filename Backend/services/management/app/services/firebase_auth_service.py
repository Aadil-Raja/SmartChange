# app/services/firebase_auth_service.py
from fastapi import HTTPException
from sqlalchemy.orm import Session
from firebase_admin import auth
from app.core.firebase import ensure_firebase_initialized
from app.core.config import get_settings
from app.repositories import users_repo
import time, jwt

settings = get_settings()
ALLOWED_DOMAINS = ['gmail.com','nu.edu.pk']
def _issue_access_token(user_id: int, token_version: int, ttl_seconds: int = 3600) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + ttl_seconds,
        "tv": token_version,
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def _domain_allowed(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return (not ALLOWED_DOMAINS) or (domain in ALLOWED_DOMAINS)

def login_with_google(db: Session, *, id_token: str):
    """
    Accept a Firebase ID token (Google), verify it, enforce domain,
    upsert a user (firebase_uid + email), and return OUR JWT.
    """
    ensure_firebase_initialized()

    # Verify Firebase ID token server-side
    try:
        claims = auth.verify_id_token(id_token, check_revoked=True)
        print(f"✅ Token verified successfully!")
        print(f"   User: {claims.get('email')}")
        print(f"   UID: {claims.get('uid')}")
        
    except auth.ExpiredIdTokenError as e:
        print(f"❌ EXPIRED TOKEN: {e}")
        raise HTTPException(status_code=401, detail="Firebase token expired")
        
    except auth.InvalidIdTokenError as e:
        print(f"❌ INVALID TOKEN: {e}")
        raise HTTPException(status_code=401, detail="Invalid Firebase token")
        
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {type(e).__name__}")
        print(f"   Details: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")
    
    
   

    uid = claims.get("uid")
    email = claims.get("email")
    email_verified = claims.get("email_verified", False)

    # We require a verified email from Google
    if not email or not email_verified:
        raise HTTPException(status_code=403, detail="Verified Google email required")

    if not _domain_allowed(email):
        raise HTTPException(status_code=403, detail="Email domain not allowed")

    # Upsert/attach this Firebase user in OUR DB
    user = users_repo.upsert_from_firebase(
        db,
        email=email.lower(),
        uid=uid,
    )

    # Issue our own access token (same shape as local login)
    token = _issue_access_token(user.id, getattr(user, "token_version", 0) or 0)
    return {"loggedIn": True, "access_token": token, "token_type": "bearer"}
