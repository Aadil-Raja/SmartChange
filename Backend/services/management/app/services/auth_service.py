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

def _issue_access_token(email: str, ttl_seconds: int = 3600) -> str:
    now = int(time.time())
    payload = {
        "sub": email,
        "iat": now,
        "exp": now + ttl_seconds
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


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
    user = users_repo.create(db, email=email_norm, name=name or "", password_hash=password_hash)
    
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
    background_tasks.add_task(send_welcome_email, email_norm, user.name)

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

    token = _issue_access_token(user.email)
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

    token = _issue_access_token(email)
    return {"loggedIn": True, "access_token": token, "token_type": "bearer"}