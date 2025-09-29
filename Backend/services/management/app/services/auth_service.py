from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.repositories import auth_repo, users_repo
from app.core.config import get_settings

import os, hashlib, hmac
from passlib.context import CryptContext

import time, jwt

# load settings once
settings = get_settings()
ALLOWED_DOMAINS = ['gmail.com']

# password hashing (bcrypt)
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

def signup(db: Session, *, email: str, password: str, name: str | None = None) -> str:
    """
    Create a new user (email/password/name). If already exists -> 409.
    Sets email_verified=False. Generates OTP and returns raw code (dev only).
    """
    email_norm = email.strip().lower()
    if not _domain_allowed(email_norm):
        raise HTTPException(status_code=403, detail="Email domain not allowed")

    existing = users_repo.get_by_email(db, email_norm)
    if existing:
        # if exists, say already registered (no resend here)
        raise HTTPException(status_code=409, detail="Email already registered")

    # create user with hashed password; ensure email_verified is False if column exists
    password_hash = _hash_password(password)
    print(password_hash)
    user = users_repo.create(db, email=email_norm, name=name or "", password_hash=password_hash)
    try:
        # only if your model has this column
        user.email_verified = False
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()

    # generate OTP
    code = _gen_code()
    code_hash = _hash_code(code)
    auth_repo.create_otp(db, email=email_norm, code_hash=code_hash, ttl_minutes=10)

    # dev-only: return raw code
    return code

def request_code(db: Session, *, email: str) -> str:
    """
    Resend OTP only if user exists and is not verified. Returns raw code (dev only).
    """
    email_norm = email.strip().lower()
    if not _domain_allowed(email_norm):
        raise HTTPException(status_code=403, detail="Email domain not allowed")

    user = users_repo.get_by_email(db, email_norm)
    if not user:
        raise HTTPException(status_code=404, detail="Signup required")
    # if model lacks email_verified, remove this guard
    try:
        if getattr(user, "email_verified", False):
            raise HTTPException(status_code=409, detail="Already verified")
    except AttributeError:
        pass

    code = _gen_code()
    code_hash = _hash_code(code)
    auth_repo.create_otp(db, email=email_norm, code_hash=code_hash, ttl_minutes=10)
    return code

def verify_code(db: Session, *, email: str, code: str, name: str | None = None) -> str:
    """
    Verify OTP only for existing, unverified users.
    Consumes OTP and marks user verified. Returns the raw code (dev only).
    """
    email_norm = email.strip().lower()
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        raise HTTPException(status_code=404, detail="Signup required")
    try:
        if getattr(user, "email_verified", False):
            raise HTTPException(status_code=409, detail="Already verified")
    except AttributeError:
        # if your model doesn't have email_verified, treat as not-verified flow
        pass

    otp = auth_repo.get_latest_active(db, email_norm)
    if not otp:
        raise HTTPException(status_code=400, detail="No active code; request a new one.")

    # constant-time compare
    if not hmac.compare_digest(otp.code_hash, _hash_code(code)):
        auth_repo.increment_attempts(db, otp)
        raise HTTPException(status_code=400, detail="Invalid code.")

    # consume OTP and mark verified (ideally in one transaction)
    auth_repo.consume(db, otp)
    try:
        # only if your model has this column
        user.email_verified = True
        if name and not user.name:
            user.name = name
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    # dev-only
    return code


# ---------- LOGIN via PASSWORD ----------
def login_password(db: Session, *, email: str, password: str):
    user = users_repo.get_by_email(db, email.strip().lower())
    if not user:
        raise HTTPException(status_code=404, detail="No account. Please sign up.")

    if not _verify_password(password, getattr(user, "password_hash", None)):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not getattr(user, "email_verified", False):
        # send code instead of token
        code = _gen_code()
        auth_repo.create_otp(db, email=user.email, code_hash=_hash_code(code), ttl_minutes=10)
        return {"loggedIn": False, "requireVerification": True, "dev_code": code}

    # verified + password ok → issue token
    token = _issue_access_token(user.email)
    return {"loggedIn": True, "access_token": token, "token_type": "bearer"}


# ---------- LOGIN via CODE (resend + verify) ----------
def login_send_code(db: Session, *, email: str) -> str:
    """
    Resend a login code. Requires existing account (verified or not).
    """
    email_norm = email.strip().lower()
    user = users_repo.get_by_email(db, email_norm)
    if not user:
        raise HTTPException(status_code=404, detail="No account. Please sign up.")

    code = _gen_code()
    auth_repo.create_otp(db, email=email_norm, code_hash=_hash_code(code), ttl_minutes=10)
    return code  # dev only

def login_verify_code(db: Session, *, email: str, code: str):
    """
    Verify a login code:
      - 404 if no account
      - validates OTP
      - consumes OTP
      - if user not verified yet, mark verified
      - returns loggedIn True
    """
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

    # consume & possibly mark verified, as one transaction-ish
    auth_repo.consume(db, otp)
    try:
        if getattr(user, "email_verified", False) is False:
            user.email_verified = True
        db.commit(); db.refresh(user)
    except Exception:
        db.rollback()
        raise

    token = _issue_access_token(email)
    return {"loggedIn": True, "access_token": token, "token_type": "bearer"}
