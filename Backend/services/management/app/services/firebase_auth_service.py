# app/services/firebase_auth_service.py

from sqlalchemy.orm import Session
from firebase_admin import auth

from app.core.firebase import ensure_firebase_initialized
from app.core.config import get_settings
from app.repositories import users_repo
from app.utils.response_utils import make_response

from app.utils.shared_utils import (
    normalize_email,
    domain_allowed,
    issue_access_token,
)

settings = get_settings()
ALLOWED_DOMAINS = ["gmail.com", "nu.edu.pk"]

def login_with_google(db: Session, *, id_token: str):
    ensure_firebase_initialized()

    # Add retry logic for clock skew
    max_retries = 2
    for attempt in range(max_retries):
        try:
            print(f"🔍 Verifying token (attempt {attempt + 1})...")
            
            # verify_id_token has built-in 5-minute clock skew tolerance
            claims = auth.verify_id_token(id_token, check_revoked=True)
            
            print(f"✅ Token verified! UID: {claims.get('uid')}, Email: {claims.get('email')}")
            break
            
        except auth.ExpiredIdTokenError as e:
            print(f"❌ Token expired: {e}")
            return make_response(False, "Authentication token expired", status_code=401)
            
        except auth.InvalidIdTokenError as e:
            error_msg = str(e)
            
            # Check if it's a clock skew issue
            if "used too early" in error_msg or "used too late" in error_msg:
                if attempt < max_retries - 1:
                    print(f"⚠️ Clock skew detected, retrying in 1 second...")
                    import time
                    time.sleep(1)
                    continue
                else:
                    print(f"❌ Clock skew persists: {e}")
                    return make_response(
                        False, 
                        "Server time synchronization issue. Please try again.", 
                        status_code=401
                    )
            
            print(f"❌ Invalid token: {e}")
            return make_response(False, "Invalid authentication token", status_code=401)
            
        except Exception as e:
            print(f"❌ Unexpected error: {type(e).__name__}: {e}")
            return make_response(False, f"Authentication failed: {str(e)}", status_code=401)

    # Rest of your code...
    uid = claims.get("uid")
    email = claims.get("email")
    email_verified = claims.get("email_verified", False)
    
    if not email or not email_verified:
        return make_response(False, "Email verification required", status_code=403)
    
    if not domain_allowed(email, ALLOWED_DOMAINS):
        return make_response(False, "Email domain not allowed", status_code=403)
    
    try:
        user = users_repo.upsert_from_firebase(
            db,
            email=normalize_email(email),
            uid=uid,
        )
    except Exception:
        return make_response(False, "Failed to process user account", status_code=500)
    
    try:
        token = issue_access_token(
            user_id=user.id,
            token_version=getattr(user, "token_version", 0) or 0,
            ttl_seconds=3600,
            jwt_secret=settings.jwt_secret,
            jwt_algorithm=settings.jwt_algorithm,
        )
    except Exception:
        return make_response(False, "Failed to generate access token", status_code=500)
    
    return make_response(
        True,
        "Login successful",
        data={
            "access_token": token,
            "token_type": "bearer"
        },
        status_code=200
    )