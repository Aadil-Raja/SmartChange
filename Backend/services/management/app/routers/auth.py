from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.deps.db import get_db
from shared.schemas import RequestCodeIn, VerifyCodeIn, UserCreate,LoginPasswordIn
from app.services import auth_service

router = APIRouter()
# ----- SIGNUP -----
@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Create account (email, password, name). If email exists -> 409.
    Returns OTP code (dev only) and a message.
    """
    code = auth_service.signup(db, email=payload.email, password=payload.password, name=payload.name)
    return {
        "message": "Sign-up successful. Enter the verification code.",
        "dev_code": code
    }

@router.post("/request-code", status_code=status.HTTP_200_OK)
def request_code(payload: RequestCodeIn, db: Session = Depends(get_db)):
    """
    Resend OTP for an existing, unverified user only. Returns code (dev only).
    """
    code = auth_service.request_code(db, email=payload.email)
    return {
        "message": "If the account exists and is unverified, a new code was generated.",
        "dev_code": code
    }

@router.post("/verify-code", status_code=status.HTTP_200_OK)
def verify_code(payload: VerifyCodeIn, db: Session = Depends(get_db)):
    """
    Verify OTP for an existing, unverified user. Consumes OTP and marks verified.
    Returns the same code (dev only) and a success flag.
    """
    c = auth_service.verify_code(db, email=payload.email, code=payload.code, name=payload.name)
    return {"codeVerified": True, "dev_code": c}






# ----- LOGIN (password) -----
@router.post("/login/password", status_code=status.HTTP_200_OK)
def login_password(payload: LoginPasswordIn, db: Session = Depends(get_db)):
    """
    Password login. If unverified, a code is generated & returned (dev).
    """
    result = auth_service.login_password(db, email=payload.email, password=payload.password)
    return result  
# ----- LOGIN (code: resend) -----
@router.post("/login/request-code", status_code=status.HTTP_200_OK)
def login_request_code(payload: RequestCodeIn, db: Session = Depends(get_db)):
    """
    Resend a login code for an existing account. Returns dev_code now.
    """
    code = auth_service.login_send_code(db, email=payload.email)
    return {"message": "Code generated.", "dev_code": code}

# ----- LOGIN (code: verify) -----
@router.post("/login/verify-code", status_code=status.HTTP_200_OK)
def login_verify_code(payload: VerifyCodeIn, db: Session = Depends(get_db)):
    """
    Verify the login code (works for both verified & unverified accounts).
    If unverified, this marks the user verified too.
    """
    result = auth_service.login_verify_code(db, email=payload.email, code=payload.code)
    return result  