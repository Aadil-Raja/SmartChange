# app/services/firebase_auth_service.py

from sqlalchemy.orm import Session
from firebase_admin import auth

from app.core.firebase import ensure_firebase_initialized
from app.core.config import get_settings
from app.repositories import users_repo
from app.utils.response_utils import make_response

from app.services.shared_utils import (
    normalize_email,
    domain_allowed,
    issue_access_token,
)

settings = get_settings()
ALLOWED_DOMAINS = ["gmail.com", "nu.edu.pk"]


def login_with_google(db: Session, *, id_token: str):
    """
    Authenticate user with Google via Firebase ID token.
    
    Flow:
    1. Verify Firebase ID token
    2. Validate email and domain
    3. Create/update user in database
    4. Issue access token
    """
    ensure_firebase_initialized()

    # Verify Firebase token
    try:
        claims = auth.verify_id_token(id_token, check_revoked=True)
    except auth.ExpiredIdTokenError:
        return make_response(False, "Authentication token expired", status_code=401)
    except auth.InvalidIdTokenError:
        return make_response(False, "Invalid authentication token", status_code=401)
    except Exception:
        return make_response(False, "Authentication failed", status_code=401)

    # Extract claims
    uid = claims.get("uid")
    email = claims.get("email")
    email_verified = claims.get("email_verified", False)

    # Validate email verification
    if not email or not email_verified:
        return make_response(False, "Email verification required", status_code=403)

    # Check domain allowlist
    if not domain_allowed(email, ALLOWED_DOMAINS):
        return make_response(False, "Email domain not allowed", status_code=403)

    # Create or update user
    try:
        user = users_repo.upsert_from_firebase(
            db,
            email=normalize_email(email),
            uid=uid,
        )
    except Exception:
        return make_response(False, "Failed to process user account", status_code=500)

    # Issue access token
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