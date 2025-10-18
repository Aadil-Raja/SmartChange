from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.services import chat_manage_service
from app.utils.response_utils import make_response
from app.schemas import ChatRenameIn
router = APIRouter()

@router.get("/heads", status_code=status.HTTP_200_OK)
def list_heads_route(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        user_id = int(user)
        data = chat_manage_service.list_heads(db, user_id=user_id, limit=limit, offset=offset)
        return make_response(True, "OK", data=data, status_code=200)
    except Exception as e:
        return make_response(False, "Unexpected server error ", status_code=500)

@router.get("/{chathead_id}/messages", status_code=status.HTTP_200_OK)
def list_messages_route(
    chathead_id: int,
    limit: int = Query(50, ge=1, le=200),
    before_id: int | None = Query(None, ge=1),
    after_id: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        user_id = int(user)
        data = chat_manage_service.list_messages(
            db, user_id=user_id, chathead_id=chathead_id, limit=limit, before_id=before_id, after_id=after_id
        )
        return make_response(True, "OK", data=data, status_code=200)
    except PermissionError as e:
        return make_response(False, str(e), status_code=403)
    except Exception:
        return make_response(False, "Unexpected server error", status_code=500)

@router.patch("/{chathead_id}/title", status_code=status.HTTP_200_OK)
def rename_head_route(
    chathead_id: int,
    payload: ChatRenameIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        user_id = int(user)
        chat_manage_service.rename_head(db, user_id = user_id, chathead_id=chathead_id, title=payload.title.strip())
        return make_response(True, "Renamed", data={"chathead_id": chathead_id, "title": payload.title.strip()}, status_code=200)
    except PermissionError as e:
        return make_response(False, str(e), status_code=403)
    except Exception:
        return make_response(False, "Unexpected server error", status_code=500)

@router.delete("/{chathead_id}", status_code=status.HTTP_200_OK)
def delete_head_route(
    chathead_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    try:
        user_id = int(user)
        chat_manage_service.delete_head(db, user_id=user_id, chathead_id=chathead_id)
        return make_response(True, "Deleted", data={"chathead_id": chathead_id}, status_code=200)
    except PermissionError as e:
        return make_response(False, str(e), status_code=403)
    except Exception:
        return make_response(False, "Unexpected server error", status_code=500)
