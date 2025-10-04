from fastapi import APIRouter, Depends, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.deps.db import get_db
from app.utils.response_utils import make_response
import shared.schemas as schemas
from app.services import auth_service, firebase_auth_service

router = APIRouter()

# ----- SIGNUP -----
@router.post("/signup", status_code=status.HTTP_200_OK)
async def signup(
    payload: schemas.UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Create account (email, password, name). If email exists -> 409.
    Sends OTP via email.
    """
    try:
        return await auth_service.signup(
            db,
            email=payload.email,
            password=payload.password,
            # name=payload.name,
            background_tasks=background_tasks
        )
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


@router.post("/request-code", status_code=status.HTTP_200_OK)
async def request_code(
    payload: schemas.RequestCodeIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Resend OTP for an existing, unverified user only.
    """
    try:
        return await auth_service.request_code(
            db,
            email=payload.email,
            background_tasks=background_tasks
        )
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


@router.post("/verify-code", status_code=status.HTTP_200_OK)
async def verify_code(
    payload: schemas.VerifyCodeIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Verify OTP for an existing, unverified user.
    """
    try:
        return await auth_service.verify_code(
            db,
            email=payload.email,
            code=payload.code,
            # name=payload.name,
            background_tasks=background_tasks
        )
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


# ----- LOGIN (password) -----
@router.post("/login/password", status_code=status.HTTP_200_OK)
async def login_password(
    payload: schemas.LoginPasswordIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Password login. If unverified, sends OTP via email.
    """
    try:
        return await auth_service.login_password(
            db,
            email=payload.email,
            password=payload.password,
            background_tasks=background_tasks
        )
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


# ----- LOGIN (code: resend) -----
@router.post("/login/request-code", status_code=status.HTTP_200_OK)
async def login_request_code(
    payload: schemas.RequestCodeIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Resend a login code for an existing account.
    """
    try:
        return await auth_service.login_send_code(
            db,
            email=payload.email,
            background_tasks=background_tasks
        )
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


# ----- LOGIN (code: verify) -----
@router.post("/login/verify-code", status_code=status.HTTP_200_OK)
async def login_verify_code(
    payload: schemas.VerifyCodeIn,
    db: Session = Depends(get_db)
):
    """
    Verify the login code.
    """
    try:
        return await auth_service.login_verify_code(
            db,
            email=payload.email,
            code=payload.code
        )
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


@router.post("/password-reset/request", status_code=status.HTTP_200_OK)
def password_reset_request(
    payload: schemas.PasswordResetRequestIn,
    db: Session = Depends(get_db)
):
    """
    Always returns 200 with a message. In DEV returns a link you can click.
    In PROD you would email this link to the user instead of returning it.
    """
    try:
        return auth_service.request_password_reset(db, email=payload.email)
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
def password_reset_confirm(
    payload: schemas.PasswordResetConfirmIn,
    db: Session = Depends(get_db)
):
    """
    User posts token + new_password. We validate token, set new password,
    and bump token_version to revoke older tokens.
    """
    try:
        return auth_service.confirm_password_reset(
            db,
            token=payload.token,
            new_password=payload.new_password
        )
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


@router.post("/firebase", status_code=status.HTTP_200_OK)
def firebase_login(
    payload: schemas.FirebaseLoginIn,
    db: Session = Depends(get_db)
):
    """
    Accepts Firebase ID token (Google sign-in) and returns your backend JWT.
    """
    try:
        return firebase_auth_service.login_with_google(db, id_token=payload.id_token)
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)