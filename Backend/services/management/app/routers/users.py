from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.deps.db import get_db
from shared.schemas import UserCreate, UserOut

from app.services.users_service import create_user ,list_users

router = APIRouter()

@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_route(payload: UserCreate, db: Session = Depends(get_db)):
    try:
        user = create_user(db, email=payload.email, name=payload.name, password=payload.password)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.get("/", response_model=list[UserOut])
def list_users_route(db: Session = Depends(get_db)):
    return list_users(db)