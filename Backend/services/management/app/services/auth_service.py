# app/services/auth_service.py

from sqlalchemy.orm import Session
from fastapi import BackgroundTasks
from app.repositories import auth_repo
from shared.repos import users_repo
from app.core.config import get_settings
from app.services.email_service import send_otp_email, send_welcome_email, send_password_reset_email
from app.services.queue.factory import get_queue
from app.utils.response_utils import make_response

from app.utils.shared_utils import (
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

settings = get_settings()
ALLOWED_DOMAINS = ['gmail.com', 'yahoo.com','nu.edu.pk']  # Example allowed domains; replace with settings.allowed_domains_raw.split(',')

RQ_DEADLINE_TASK = "tasks.check_deadline_notifications"


def _enqueue_deadline_check(user_id: int):
    """Fire-and-forget: enqueue deadline notification check for a user."""
    try:
        get_queue().enqueue(RQ_DEADLINE_TASK, user_id=user_id)
    except Exception:
        pass  # Never block login if queue is unavailable

# ----------------------------------------------------------------------
# SIGNUP & VERIFICATION
# ----------------------------------------------------------------------

async def signup(
    db: Session,
    *,
    email: str,
    password: str,
    name: str,
    background_tasks: BackgroundTasks,
):
    """
    Create a new user account.
    Returns: next_action="verify_email" to guide frontend flow.
    """
    email_norm = normalize_email(email)
    
    if not domain_allowed(email_norm, ALLOWED_DOMAINS):
        return make_response(False, "Email domain not allowed", status_code=403)

    if users_repo.get_by_email(db, email_norm):
        return make_response(False, "Email already registered", status_code=409)

    # Create user
    password_hash = hash_password(password)
    user = users_repo.create(db, email=email_norm, password_hash=password_hash)

    try:
        user.email_verified = False
        if name:
            user.Name = name
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        return make_response(False, "Failed to create user", status_code=500)

    # Send OTP
    code = gen_code_6()
    code_hash = sha256_str(code)
    auth_repo.create_otp(db, email=email_norm, code_hash=code_hash, ttl_minutes=10)
    background_tasks.add_task(send_otp_email, email_norm, code, "verification")
    
    return make_response(
        True,
        "Account created. Please verify your email.",
        data={"email": email_norm},  # Only essential info
        next_action="verify_email",
        status_code=201,
    )


async def request_code(
    db: Session,
    *,
    email: str,
    background_tasks: BackgroundTasks,
):
    """
    Resend verification code for unverified account.
    """
    email_norm = normalize_email(email)
    print("here")
    if not domain_allowed(email_norm, ALLOWED_DOMAINS):
        return make_response(False, "Email domain not allowed", status_code=403)
    print("here1")
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        return make_response(False, "Account not found", status_code=404)

    if getattr(user, "email_verified", False):
        return make_response(False, "Email already verified", status_code=409)

    # Send new code
    code = gen_code_6()
    code_hash = sha256_str(code)
    auth_repo.create_otp(db, email=email_norm, code_hash=code_hash, ttl_minutes=10)
    background_tasks.add_task(send_otp_email, email_norm, code, "verification")
    
    return make_response(
        True,
        "Verification code sent to your email",
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
    Verify email with OTP code.
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)
    
    if not user:
        return make_response(False, "Account not found", status_code=404)
    print("here")
    if getattr(user, "email_verified", False):
        return make_response(False, "Email already verified", status_code=409)

    otp = auth_repo.get_latest_active(db, email_norm)
    if not otp:
        return make_response(False, "No active code. Please request a new one.", status_code=400)

    if not safe_equals(otp.code_hash, sha256_str(code)):
        auth_repo.increment_attempts(db, otp)
        return make_response(False, "Invalid verification code", status_code=400)
    
    # Mark as verified
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

    background_tasks.add_task(send_welcome_email, email_norm, "set name")
    
    return make_response(
        True,
        "Email verified successfully",
        next_action="login",  # Guide user to login
        status_code=200
    )


# ----------------------------------------------------------------------
# LOGIN
# ----------------------------------------------------------------------

async def login_password(
    db: Session,
    *,
    email: str,
    password: str,
    background_tasks: BackgroundTasks,
):
    """
    Login with email/password.
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)
    
    if not user:
        return make_response(False, "Invalid email or password", status_code=401)

    if not verify_password(password, getattr(user, "password_hash", None)):
        return make_response(False, "Invalid email or password", status_code=401)

    # Check if email verified
    if not getattr(user, "email_verified", False):
        code = gen_code_6()
        auth_repo.create_otp(db, email=email_norm, code_hash=sha256_str(code), ttl_minutes=10)
        background_tasks.add_task(send_otp_email, email_norm, code, "login")
        
        return make_response(
            False,
            "Please verify your email to continue",
            data={"email": email_norm},
            next_action="verify_email",
            status_code=403,  # Forbidden until verified
        )

    # Issue token
    token = issue_access_token(
        user_id=user.id,
        token_version=getattr(user, "token_version", 0) or 0,
        ttl_seconds=3600,
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
    )

    _enqueue_deadline_check(user.id)

    return make_response(
        True,
        "Login successful",
        data={
            "access_token": token,
            "token_type": "bearer",
            "name": user.Name
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
    Send login OTP (passwordless login).
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)
    
    if not user:
        return make_response(False, "Account not found", status_code=404)

    code = gen_code_6()
    auth_repo.create_otp(db, email=email_norm, code_hash=sha256_str(code), ttl_minutes=10)
    background_tasks.add_task(send_otp_email, email_norm, code, "login")
    
    return make_response(
        True,
        "Login code sent to your email",
        data={"email": email_norm},
        next_action="verify_login_code",
        status_code=200
    )


async def login_verify_code(
    db: Session,
    *,
    email: str,
    code: str,
):
    """
    Verify login OTP and issue token.
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)
    
    if not user:
        return make_response(False, "Account not found", status_code=404)

    otp = auth_repo.get_latest_active(db, email_norm)
    if not otp:
        return make_response(False, "No active code. Please request a new one.", status_code=400)

    if not safe_equals(otp.code_hash, sha256_str(code)):
        auth_repo.increment_attempts(db, otp)
        return make_response(False, "Invalid login code", status_code=400)

    auth_repo.consume(db, otp)
    
    # Auto-verify email if not verified
    try:
        if not getattr(user, "email_verified", False):
            user.email_verified = True
            db.commit()
            db.refresh(user)
    except Exception:
        db.rollback()
        return make_response(False, "Login failed", status_code=500)

    # Issue token
    token = issue_access_token(
        user_id=user.id,
        token_version=getattr(user, "token_version", 0) or 0,
        ttl_seconds=3600,
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
    )

    _enqueue_deadline_check(user.id)

    return make_response(
        True,
        "Login successful",
        data={
            "access_token": token,
            "token_type": "bearer"
            ,"name": user.Name
        },
        status_code=200
    )


# ----------------------------------------------------------------------
# PASSWORD RESET
# ----------------------------------------------------------------------

def request_password_reset(
    db: Session,
    *,
    email: str,
    background_tasks: BackgroundTasks,
):
    """
    Request password reset link.
    Always returns success to prevent email enumeration.
    """
    email_norm = normalize_email(email)
    user = users_repo.get_by_email(db, email_norm)

    if user:
        token = issue_reset_token(
            user_id=user.id,
            token_version=getattr(user, "token_version", 0) or 0,
            ttl_seconds=3600,
            jwt_secret=settings.jwt_secret,
            jwt_algorithm=settings.jwt_algorithm,
        )
        base = getattr(settings, "reset_password_url", "http://localhost:5173/reset-password")
        link = f"{base}?token={token}"
        background_tasks.add_task(send_password_reset_email, email_norm, link)

    return make_response(
        True,
        "If an account exists, a password reset link has been sent",
        status_code=200
    )


def confirm_password_reset(
    db: Session,
    *,
    token: str,
    new_password: str,
):
    """
    Reset password using token.
    """
    try:
        data = decode_token(
            token,
            jwt_secret=settings.jwt_secret,
            jwt_algorithm=settings.jwt_algorithm,
        )
    except Exception as e:
        if "expired" in str(e).lower():
            return make_response(False, "Reset link has expired", status_code=400)
        return make_response(False, "Invalid reset link", status_code=400)

    if data.get("typ") != "reset":
        return make_response(False, "Invalid reset link", status_code=400)

    user_id = int(data.get("sub"))
    token_tv = data.get("tv", 0)

    user = users_repo.get_by_id(db, user_id)
    if not user:
        return make_response(False, "Invalid reset link", status_code=400)

    # Check token version
    current_tv = getattr(user, "token_version", 0) or 0
    if token_tv != current_tv:
        return make_response(False, "Reset link already used or expired", status_code=400)

    # Update password
    user.password_hash = hash_password(new_password)
    try:
        if hasattr(user, "token_version"):
            user.token_version = current_tv + 1
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        return make_response(False, "Failed to update password", status_code=500)
    
    return make_response(
        True,
        "Password updated successfully",
        next_action="login",
        status_code=200
    )