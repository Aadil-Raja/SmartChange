# app/services/auth_service.py

from sqlalchemy.orm import Session
from fastapi import BackgroundTasks
from app.repositories import auth_repo, users_repo
from app.core.config import get_settings
from app.services.email_service import send_otp_email, send_welcome_email
from app.utils.response_utils import make_response

# central primitives (no settings/repo imports inside utils)
from app.services.shared_utils import (
    normalize_email,
    domain_allowed,
    hash_password,
    verify_password,
    gen_code_6,
    sha256_str,
    safe_equals,
    issue_access_token,
    issue_reset_token,
    decode_token,
)

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
settings = get_settings()

# If empty/None => no domain restriction
ALLOWED_DOMAINS = ["gmail.com", "nu.edu.pk"]


# ----------------------------------------------------------------------
# Sign-up / Verification / Login (password & code) / Reset Password
# ----------------------------------------------------------------------

async def signup(
    db: Session,
    *,
    email: str,
    password: str,
    name: str | None = None,
    background_tasks: BackgroundTasks,
):
    """
    Create a new user (email/password/name).
    - Normalizes and domain-checks the email.
    - Fails if user already exists.
    - Persists the user with email_verified=False.
    - Generates a 6-digit OTP, stores its hash, and emails the code.
    """
    email_norm = normalize_email(email)
    if not domain_allowed(email_norm, ALLOWED_DOMAINS):
        return make_response(False, "Email domain not allowed", status_code=403)

    existing = users_repo.get_by_email(db, email_norm)
    if existing:
        return make_response(False, "Email already registered", status_code=409)

    # hash & create user
    password_hash = hash_password(password)
    user = users_repo.create(db, email=email_norm, password_hash=password_hash)

    # ensure verified flag stored
    try:
        user.email_verified = False
        if name and not getattr(user, "name", None):
            user.name = name
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        return make_response(False, "Failed to create user", status_code=500)

    # create and email OTP
    code = gen_code_6()
    code_hash = sha256_str(code)
    auth_repo.create_otp(db, email=email_norm, code_hash=code_hash, ttl_minutes=10)

    background_tasks.add_task(send_otp_email, email_norm, code, "verification")
    
    return make_response(
        True,
        "Sign-up successful. Check your email for verification code.",
        data={"dev_code": code},  # Remove in production
        status_code=201
    )


async def request_code(
    db: Session,
    *,
    email: str,
    background_tasks: BackgroundTasks,
):
    """
    Resend an OTP for an *existing* but *unverified* account.
    - Normalizes and domain-checks the email.
    - Fails if user does not exist.
    - Fails if already verified.
    - Issues a fresh code and emails it.
    """
    email_norm = normalize_email(email)
    if not domain_allowed(email_norm, ALLOWED_DOMAINS):
        return make_response(False, "Email domain not allowed", status_code=403)

    user = users_repo.get_by_email(db, email_norm)
    if not user:
        return make_response(False, "Signup required", status_code=404)

    try:
        if getattr(user, "email_verified", False):
            return make_response(False, "Already verified", status_code=409)
    except AttributeError:
        # If the column doesn't exist yet, treat as unverified
        pass

    code = gen_code_6()
    code_hash = sha256_str(code)
    auth_repo.create_otp(db, email=email_norm, code_hash=code_hash, ttl_minutes=10)

    background_tasks.add_task(send_otp_email, email_norm, code, "verification")
    
    return make_response(
        True,
        "If the account exists and is unverified, a code was sent to your email.",
        data={"dev_code": code},  # Remove in production
        status_code=200
    )


async def verify_code(
    db: Session,
    *,
    email: str,
    code: str,
    name: str | None = None,
    background_tasks: BackgroundTasks,
):
    """
    Verify an OTP for an existing, unverified user.
    - Fails if user doesn't exist.
    - Fails if already verified.
    - Validates against the latest active OTP using a constant-time compare.
    - Consumes OTP and marks user as verified.
    - Sends a welcome email.
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        return make_response(False, "Signup required", status_code=404)

    try:
        if getattr(user, "email_verified", False):
            return make_response(False, "Already verified", status_code=409)
    except AttributeError:
        pass

    otp = auth_repo.get_latest_active(db, email_norm)
    if not otp:
        return make_response(False, "No active code; request a new one.", status_code=400)

    if not safe_equals(otp.code_hash, sha256_str(code)):
        auth_repo.increment_attempts(db, otp)
        return make_response(False, "Invalid code.", status_code=400)

    # consume & mark verified
    auth_repo.consume(db, otp)
    try:
        user.email_verified = True
        if name and not getattr(user, "name", None):
            user.name = name
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        return make_response(False, "Failed to verify email", status_code=500)

    background_tasks.add_task(send_welcome_email, email_norm, "send name")
    
    return make_response(
        True,
        "Email verified successfully! Welcome email sent.",
        data={"codeVerified": True, "dev_code": code},  # Remove dev_code in production
        status_code=200
    )


async def login_password(
    db: Session,
    *,
    email: str,
    password: str,
    background_tasks: BackgroundTasks,
):
    """
    Password login flow.
    - Fails if user not found.
    - Verifies password.
    - If user isn't verified, emails a login OTP and returns a 'requireVerification' response.
    - If verified, issues an access JWT (bearer).
    """
    user = users_repo.get_by_email(db, normalize_email(email))
    if not user:
        return make_response(False, "No account. Please sign up.", status_code=404)

    if not verify_password(password, getattr(user, "password_hash", None)):
        return make_response(False, "Invalid credentials", status_code=401)

    if not getattr(user, "email_verified", False):
        # send a login OTP
        code = gen_code_6()
        auth_repo.create_otp(db, email=user.email, code_hash=sha256_str(code), ttl_minutes=10)
        background_tasks.add_task(send_otp_email, user.email, code, "login")
        
        return make_response(
            True,
            "Verification required. Check your email for login code.",
            data={
                "loggedIn": False,
                "requireVerification": True,
                "dev_code": code  # Remove in production
            },
            status_code=200
        )

    # issue access token
    token = issue_access_token(
        user_id=user.id,
        token_version=getattr(user, "token_version", 0) or 0,
        ttl_seconds=3600,
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
    )
    
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


async def login_send_code(
    db: Session,
    *,
    email: str,
    background_tasks: BackgroundTasks,
):
    """
    Send (or resend) a login OTP for an existing user.
    - Fails if account doesn't exist.
    - Issues a fresh code and emails it.
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        return make_response(False, "No account. Please sign up.", status_code=404)

    code = gen_code_6()
    auth_repo.create_otp(db, email=email_norm, code_hash=sha256_str(code), ttl_minutes=10)
    background_tasks.add_task(send_otp_email, email_norm, code, "login")
    
    return make_response(
        True,
        "Login code sent to your email.",
        data={"dev_code": code},  # Remove in production
        status_code=200
    )


async def login_verify_code(
    db: Session,
    *,
    email: str,
    code: str,
):
    """
    Verify a login OTP.
    - Fails if account doesn't exist.
    - Validates the latest active OTP and consumes it.
    - Auto-sets email_verified=True if it was False.
    - Issues an access JWT on success.
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        return make_response(False, "No account. Please sign up.", status_code=404)

    otp = auth_repo.get_latest_active(db, email_norm)
    if not otp:
        return make_response(False, "No active code; request a new one.", status_code=400)

    if not safe_equals(otp.code_hash, sha256_str(code)):
        auth_repo.increment_attempts(db, otp)
        return make_response(False, "Invalid code.", status_code=400)

    auth_repo.consume(db, otp)
    try:
        if getattr(user, "email_verified", False) is False:
            user.email_verified = True
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        return make_response(False, "Failed to verify code", status_code=500)

    token = issue_access_token(
        user_id=user.id,
        token_version=getattr(user, "token_version", 0) or 0,
        ttl_seconds=3600,
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
    )
    
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


def request_password_reset(
    db: Session,
    *,
    email: str,
):
    """
    Generate a password reset link for this email.
    - Always returns a 200 (do not leak account existence).
    - If user exists, embeds a short-lived reset token in the link.
    - Otherwise returns a dummy-shaped link.
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)

    if user:
        token_version = getattr(user, "token_version", 0) or 0
        token = issue_reset_token(
            user_id=user.id,
            token_version=token_version,
            ttl_seconds=3600,
            jwt_secret=settings.jwt_secret,
            jwt_algorithm=settings.jwt_algorithm,
        )
        base = getattr(settings, "reset_password_url", "http://localhost:5173/reset-password")
        link = f"{base}?token={token}"
    else:
        # keep response shape consistent; do not reveal existence
        link = "http://localhost:5173/reset-password?token=dummy"

    return make_response(
        True,
        "If the email exists, a reset link has been generated.",
        data={"dev_link": link},  # Remove in production
        status_code=200
    )


def confirm_password_reset(
    db: Session,
    *,
    token: str,
    new_password: str,
):
    """
    Confirm a password reset using the provided token.
    - Decodes and validates the token (type, expiry).
    - Checks token_version for revocation protection.
    - Updates the user's password hash.
    - Bumps token_version to invalidate any previously issued tokens.
    """
    # decode & basic validation
    try:
        data = decode_token(
            token,
            jwt_secret=settings.jwt_secret,
            jwt_algorithm=settings.jwt_algorithm,
        )
    except Exception as e:
        err = str(e)
        if "Signature has expired" in err:
            return make_response(False, "Reset link expired", status_code=400)
        return make_response(False, "Invalid reset token", status_code=400)

    if data.get("typ") != "reset":
        return make_response(False, "Invalid token type", status_code=400)

    user_id = int(data.get("sub"))
    token_tv = data.get("tv", 0)

    user = users_repo.get_by_id(db, user_id)
    if not user:
        return make_response(False, "Invalid token (user)", status_code=400)

    # verify token_version matches the user's current snapshot
    current_tv = getattr(user, "token_version", 0) or 0
    if token_tv != current_tv:
        return make_response(False, "Reset link no longer valid", status_code=400)

    # set new password & bump token_version
    user.password_hash = hash_password(new_password)
    try:
        if hasattr(user, "token_version"):
            user.token_version = current_tv + 1
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        return make_response(False, "Could not update password", status_code=500)
    
    return make_response(
        True,
        "Password updated successfully",
        status_code=200
    )