from app.repositories import auth_repo
import hashlib, hmac, os, time, jwt
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.repositories import users_repo
from app.core.config import get_settings

# Load settings once
settings = get_settings()

JWT_SECRET = settings.jwt_secret
JWT_ALG = settings.jwt_algorithm
ALLOWED_DOMAINS = ['gmail.com']

def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()

def _gen_code() -> str:
    return f"{int.from_bytes(os.urandom(3), 'big') % 1000000:06d}"

def _issue_access_token(email: str, ttl_seconds: int = 900) -> str:
    now = int(time.time())
    payload = {"sub": email, "iat": now, "exp": now + ttl_seconds}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def request_code(db: Session, email: str) -> str | None:
    domain = email.split("@")[-1].lower()
    if domain not in ALLOWED_DOMAINS:
        return None

    code = _gen_code()
    code_hash = _hash_code(code)
    auth_repo.create_otp(db, email=email, code_hash=code_hash, ttl_minutes=10)

    # TODO: send via SMTP/SendGrid; for dev you can return it
    return code

def verify_code(db: Session, email: str, code: str, name: str | None):
    otp = auth_repo.get_latest_active(db, email)
    if not otp:
        raise HTTPException(status_code=400, detail="No active code; request a new one.")

    if not hmac.compare_digest(otp.code_hash, _hash_code(code)):
        raise HTTPException(status_code=400, detail="Invalid code.")

    auth_repo.consume(db, otp)
    user = users_repo.upsert_verified_user(db, email=email, name=name)
    token = _issue_access_token(user.email)
    return token
