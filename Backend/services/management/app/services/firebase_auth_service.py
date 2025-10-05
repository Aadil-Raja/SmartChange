# app/services/firebase_auth_service.py

from sqlalchemy.orm import Session
from firebase_admin import auth

from app.core.firebase import ensure_firebase_initialized
from app.core.config import get_settings
from app.repositories import users_repo
from app.utils.response_utils import make_response

# shared primitives (no settings/repo imports inside)
from app.services.shared_utils import (
    normalize_email,
    domain_allowed,
    issue_access_token,
)

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
settings = get_settings()

# If empty/None => no domain restriction
ALLOWED_DOMAINS = ["gmail.com", "nu.edu.pk"]


def login_with_google(db: Session, *, id_token: str):
    """
    Accept a Firebase ID token (Google), verify it, enforce domain,
    upsert a user (firebase_uid + email), and return OUR JWT.

    Steps:
      1) Ensure Firebase Admin SDK is initialized.
      2) Verify the ID token (server-side) and extract claims.
      3) Require a verified Google email and an allowed domain.
      4) Upsert the user in our DB using (email, firebase uid).
      5) Issue our own access JWT with token_version snapshot.

    Returns:
        dict: Response from make_response with login data
    """
    ensure_firebase_initialized()

    # --- 1) Verify Firebase ID token server-side ---
    # In firebase_auth_service.py, update the verify token section:

    try:
        # Add clock_skew_seconds parameter to allow some time difference
        claims = auth.verify_id_token(id_token, check_revoked=True, clock_skew_seconds=60)
        print("✅ Firebase token verified", claims.get("email"), claims.get("uid"))
    except auth.ExpiredIdTokenError as e:
        print(f"❌ Token expired: {str(e)}")
        return make_response(False, "Firebase token expired", status_code=401)
    except auth.InvalidIdTokenError as e:
        print(f"❌ Invalid token: {str(e)}")
        return make_response(False, "Invalid Firebase token", status_code=401)
    except Exception as e:
        print(f"❌ Token verification failed: {type(e).__name__}: {str(e)}")
        return make_response(False, f"Token verification failed: {str(e)}", status_code=401)
    uid = claims.get("uid")
    email = claims.get("email")
    email_verified = claims.get("email_verified", False)

    # Require a verified Google email
    if not email or not email_verified:
        return make_response(False, "Verified Google email required", status_code=403)

    # Domain allow-list (if configured)
    if not domain_allowed(email, ALLOWED_DOMAINS):
        return make_response(False, "Email domain not allowed", status_code=403)

    # --- 3) Upsert/attach this Firebase user in OUR DB ---
    try:
        user = users_repo.upsert_from_firebase(
            db,
            email=normalize_email(email),
            uid=uid,
        )
    except Exception as e:
        return make_response(False, "Failed to create or update user", status_code=500)

    # --- 4) Issue our own access token (same shape as local login) ---
    try:
        token = issue_access_token(
            user_id=user.id,
            token_version=getattr(user, "token_version", 0) or 0,
            ttl_seconds=3600,
            jwt_secret=settings.jwt_secret,
            jwt_algorithm=settings.jwt_algorithm,
        )
    except Exception as e:
        return make_response(False, "Failed to generate access token", status_code=500)

    return make_response(
        True,
        "Login successful",
        data={
            "loggedIn": True,
            "access_token": token,
            "token_type": "bearer"
        },
        status_code=200
    )