from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.deps.db import get_db
from shared.schemas import RequestCodeIn, VerifyCodeIn, TokenOut, MeOut
from app.services import auth_service
import jwt, os

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/request-code", status_code=status.HTTP_200_OK)
def request_code(payload: RequestCodeIn, db: Session = Depends(get_db)):
    code = auth_service.request_code(db, email=payload.email)
    return {"message": "If the email is allowed, a code was sent.", "dev_code": code}

@router.post("/verify-code", response_model=TokenOut)
def verify_code(payload: VerifyCodeIn, db: Session = Depends(get_db)):
    token = auth_service.verify_code(db, email=payload.email, code=payload.code, name=payload.name)
    return {"access_token": token, "token_type": "bearer"}

# JWT guard
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALG = "HS256"

def current_user(authorization: str = Header(...)):
    try:
        scheme, token = authorization.split(" ")
        assert scheme.lower() == "bearer"
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return {"email": payload["sub"]}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.get("/me", response_model=MeOut)
def me(user = Depends(current_user), db: Session = Depends(get_db)):
    from app.repositories.users_repo import get_by_email
    u = get_by_email(db, user["email"])
    return u
