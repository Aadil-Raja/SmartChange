from sqlalchemy.orm import Session
from fastapi import HTTPException, BackgroundTasks
from app.repositories import auth_repo, users_repo
from app.core.config import get_settings
from app.services.email_service import send_otp_email, send_welcome_email

import os, hashlib, hmac
from passlib.context import CryptContext
import time, jwt

settings = get_settings()
ALLOWED_DOMAINS = ['gmail.com','nu.edu.pk']

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _hash_password(p: str) -> str:
    return _pwd_ctx.hash(p)

def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()

def _gen_code() -> str:
    return f"{int.from_bytes(os.urandom(3), 'big') % 1_000_000:06d}"

def _domain_allowed(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return (not ALLOWED_DOMAINS) or (domain in ALLOWED_DOMAINS)

def _verify_password(p: str, p_hash: str | None) -> bool:
    if not p_hash:
        return False
    return _pwd_ctx.verify(p, p_hash)

def _issue_access_token(user_id: int, token_version: int, ttl_seconds: int = 3600) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + ttl_seconds,
        "tv": token_version,
        "typ": "access"
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def _issue_reset_token(*, user_id: int, token_version: int, ttl_seconds: int = 3600) -> str:
    now = int(time.time())
    payload = {
       "sub": str(user_id),                 # user id
        "iat": now,
        "exp": now + ttl_seconds,       # 1 hour by default
        "tv": token_version,            # token_version snapshot
        "typ": "reset"                  # optional: distinguish reset tokens
    }
    
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def _decode_token(token: str) -> dict:
   
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Reset link expired")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    

async def signup(db: Session, *, email: str, password: str, name: str | None = None, 
                 background_tasks: BackgroundTasks) -> str:
    """
    Create a new user (email/password/name). If already exists -> 409.
    Sets email_verified=False. Generates OTP and sends via email.
    """
    email_norm = email.strip().lower()
    if not _domain_allowed(email_norm):
        raise HTTPException(status_code=403, detail="Email domain not allowed")

    existing = users_repo.get_by_email(db, email_norm)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    password_hash = _hash_password(password)
    user = users_repo.create(db, email=email_norm, password_hash=password_hash)
    
    try:
        user.email_verified = False
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()

    # Generate OTP
    code = _gen_code()
    code_hash = _hash_code(code)
    auth_repo.create_otp(db, email=email_norm, code_hash=code_hash, ttl_minutes=10)

    # Send email in background
    background_tasks.add_task(send_otp_email, email_norm, code, "verification")

    return code  # Still return for dev, remove in production


async def request_code(db: Session, *, email: str, background_tasks: BackgroundTasks) -> str:
    """
    Resend OTP only if user exists and is not verified. Sends via email.
    """
    email_norm = email.strip().lower()
    if not _domain_allowed(email_norm):
        raise HTTPException(status_code=403, detail="Email domain not allowed")

    user = users_repo.get_by_email(db, email_norm)
    if not user:
        raise HTTPException(status_code=404, detail="Signup required")
    
    try:
        if getattr(user, "email_verified", False):
            raise HTTPException(status_code=409, detail="Already verified")
    except AttributeError:
        pass

    code = _gen_code()
    code_hash = _hash_code(code)
    auth_repo.create_otp(db, email=email_norm, code_hash=code_hash, ttl_minutes=10)
    
    # Send email in background
    background_tasks.add_task(send_otp_email, email_norm, code, "verification")
    
    return code


async def verify_code(db: Session, *, email: str, code: str, name: str | None = None,
                     background_tasks: BackgroundTasks) -> str:
    """
    Verify OTP only for existing, unverified users.
    Consumes OTP and marks user verified. Sends welcome email.
    """
    email_norm = email.strip().lower()
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        raise HTTPException(status_code=404, detail="Signup required")
    
    try:
        if getattr(user, "email_verified", False):
            raise HTTPException(status_code=409, detail="Already verified")
    except AttributeError:
        pass

    otp = auth_repo.get_latest_active(db, email_norm)
    if not otp:
        raise HTTPException(status_code=400, detail="No active code; request a new one.")

    if not hmac.compare_digest(otp.code_hash, _hash_code(code)):
        auth_repo.increment_attempts(db, otp)
        raise HTTPException(status_code=400, detail="Invalid code.")

    # Consume OTP and mark verified
    auth_repo.consume(db, otp)
    try:
        user.email_verified = True
        if name and not user.name:
            user.name = name
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    # Send welcome email in background
    background_tasks.add_task(send_welcome_email, email_norm, "send name")

    return code


async def login_password(db: Session, *, email: str, password: str, 
                        background_tasks: BackgroundTasks):
    """Password login with email sending for unverified users."""
    user = users_repo.get_by_email(db, email.strip().lower())
    if not user:
        raise HTTPException(status_code=404, detail="No account. Please sign up.")

    if not _verify_password(password, getattr(user, "password_hash", None)):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not getattr(user, "email_verified", False):
        # Send code via email
        code = _gen_code()
        auth_repo.create_otp(db, email=user.email, code_hash=_hash_code(code), ttl_minutes=10)
        background_tasks.add_task(send_otp_email, user.email, code, "login")
        return {"loggedIn": False, "requireVerification": True, "dev_code": code}

    token = _issue_access_token(user.id, getattr(user, "token_version", 0) or 0)
   
    return {"loggedIn": True, "access_token": token, "token_type": "bearer"}


async def login_send_code(db: Session, *, email: str, background_tasks: BackgroundTasks) -> str:
    """Resend a login code via email."""
    email_norm = email.strip().lower()
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        raise HTTPException(status_code=404, detail="No account. Please sign up.")

    code = _gen_code()
    auth_repo.create_otp(db, email=email_norm, code_hash=_hash_code(code), ttl_minutes=10)
    
    # Send email in background
    background_tasks.add_task(send_otp_email, email_norm, code, "login")
    
    return code


async def login_verify_code(db: Session, *, email: str, code: str):
    """Verify a login code."""
    email_norm = email.strip().lower()
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        raise HTTPException(status_code=404, detail="No account. Please sign up.")

    otp = auth_repo.get_latest_active(db, email_norm)
    if not otp:
        raise HTTPException(status_code=400, detail="No active code; request a new one.")

    if not hmac.compare_digest(otp.code_hash, _hash_code(code)):
        auth_repo.increment_attempts(db, otp)
        raise HTTPException(status_code=400, detail="Invalid code.")

    auth_repo.consume(db, otp)
    try:
        if getattr(user, "email_verified", False) is False:
            user.email_verified = True
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    token = _issue_access_token(user.id, getattr(user, "token_version", 0) or 0)
    return {"loggedIn": True, "access_token": token, "token_type": "bearer"}




def request_password_reset(db: Session, *, email: str) -> str:
    """
    Generate a reset link for this email. Always return 200 from the router
    (don't leak account existence). In dev, we return the link.
    """
    email_norm = email.strip().lower()
    user = users_repo.get_by_email(db, email_norm)

    # Build link only if user exists; otherwise still return a generic link response
    if user:
        token_version = getattr(user, "token_version", 0) or 0
        token = _issue_reset_token(user_id=user.id, token_version=token_version, ttl_seconds=3600)

        # Base URL for your frontend reset page; put in .env as RESET_PASSWORD_URL if you want
        base = getattr(settings, "reset_password_url", "http://localhost:5173/reset-password")
        link = f"{base}?token={token}"
    else:
        # Do not reveal account existence. Return a fake-looking URL to keep the shape consistent.
        link = "http://localhost:5173/reset-password?token=dummy"

    return link

def confirm_password_reset(db: Session, *, token: str, new_password: str) -> None:
    """
    Validate token, set new password, and bump token_version.
    """
    
    data = _decode_token(token)


    if data.get("typ") != "reset":
        raise HTTPException(status_code=400, detail="Invalid token type")

    user_id = int(data.get("sub"))
    token_tv = data.get("tv", 0)

    user = users_repo.get_by_id(db, user_id)  # implement if missing
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token (user)")

    # Check token_version matches (revocation)
    current_tv = getattr(user, "token_version", 0) or 0
    if token_tv != current_tv:
        raise HTTPException(status_code=400, detail="Reset link no longer valid")

    # Hash and save new password; bump token_version to revoke any older tokens
    user.password_hash = _hash_password(new_password)
    try:
        if hasattr(user, "token_version"):
            user.token_version = current_tv + 1
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update password")