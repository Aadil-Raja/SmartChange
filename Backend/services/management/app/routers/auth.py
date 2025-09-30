from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.deps.db import get_db
from shared.schemas import RequestCodeIn, VerifyCodeIn, UserCreate, LoginPasswordIn
from app.services import auth_service

router = APIRouter()

# ----- SIGNUP -----
@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    payload: UserCreate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Create account (email, password, name). If email exists -> 409.
    Sends OTP via email.
    """
    code = await auth_service.signup(
        db, 
        email=payload.email, 
        password=payload.password, 
        # name=payload.name,
        background_tasks=background_tasks
    )
    return {
        "message": "Sign-up successful. Check your email for verification code.",
        "dev_code": code  # Remove in production
    }


@router.post("/request-code", status_code=status.HTTP_200_OK)
async def request_code(
    payload: RequestCodeIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Resend OTP for an existing, unverified user only.
    """
    code = await auth_service.request_code(
        db, 
        email=payload.email,
        background_tasks=background_tasks
    )
    return {
        "message": "If the account exists and is unverified, a code was sent to your email.",
        "dev_code": code  # Remove in production
    }


@router.post("/verify-code", status_code=status.HTTP_200_OK)
async def verify_code(
    payload: VerifyCodeIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Verify OTP for an existing, unverified user.
    """
    c = await auth_service.verify_code(
        db, 
        email=payload.email, 
        code=payload.code, 
        # name=payload.name,
        background_tasks=background_tasks
    )
    return {
        "codeVerified": True, 
        "message": "Email verified successfully! Welcome email sent.",
        "dev_code": c  # Remove in production
    }


# ----- LOGIN (password) -----
@router.post("/login/password", status_code=status.HTTP_200_OK)
async def login_password(
    payload: LoginPasswordIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Password login. If unverified, sends OTP via email.
    """
    result = await auth_service.login_password(
        db, 
        email=payload.email, 
        password=payload.password,
        background_tasks=background_tasks
    )
    return result


# ----- LOGIN (code: resend) -----
@router.post("/login/request-code", status_code=status.HTTP_200_OK)
async def login_request_code(
    payload: RequestCodeIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Resend a login code for an existing account.
    """
    code = await auth_service.login_send_code(
        db, 
        email=payload.email,
        background_tasks=background_tasks
    )
    return {
        "message": "Login code sent to your email.",
        "dev_code": code  # Remove in production
    }


# ----- LOGIN (code: verify) -----
@router.post("/login/verify-code", status_code=status.HTTP_200_OK)
async def login_verify_code(
    payload: VerifyCodeIn,
    db: Session = Depends(get_db)
):
    """
    Verify the login code.
    """
    result = await auth_service.login_verify_code(
        db, 
        email=payload.email, 
        code=payload.code
    )
    return result