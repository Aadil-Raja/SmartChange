from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps.db import get_db, get_management_db
from app.services import chat_service
from app.services import chat_service_v2
from app.schemas import ChatTurnIn
from app.schemas.chat import ChatTurnOutV2
from app.utils.response_utils import make_response
from app.deps.auth import get_current_user

router = APIRouter()

@router.post("/respond", status_code=status.HTTP_200_OK)
def respond_route(
    payload: ChatTurnIn,
    db: Session = Depends(get_db),
    management_db: Session = Depends(get_management_db),
    user=Depends(get_current_user),
):
    try:
        user_id = int(user)
        print(user_id)
        chathead_id = payload.chathead_id

        result = chat_service.respond_turn(
            db,
            management_db,
            user_id=user_id,
            chathead_id=chathead_id,
            active_doc_ids=payload.active_doc_ids,
            message=payload.message.strip(),
            title=payload.title,
        )
        return make_response(True, "OK", data=result, status_code=200)

    except Exception as e:
        return make_response(False, "Could not process chat response", status_code=500, error=str(e))


@router.post("/respond-v2", status_code=status.HTTP_200_OK)
def respond_route_v2(
    payload: ChatTurnIn,
    db: Session = Depends(get_db),
    management_db: Session = Depends(get_management_db),
    user=Depends(get_current_user),
):
    """
    V2 endpoint - returns structured response with citations.
    Response includes: chathead_id, answer, has_contradiction, citations[].
    Each citation has: doc_id, doc_title, page, section, snippet.
    """
    try:
        user_id = int(user)
        chathead_id = payload.chathead_id

        result = chat_service_v2.respond_turn_v2(
            db,
            management_db,
            user_id=user_id,
            chathead_id=chathead_id,
            active_doc_ids=payload.active_doc_ids,
            message=payload.message.strip(),
            title=payload.title,
        )
        return make_response(True, "OK", data=result, status_code=200)

    except Exception as e:
        return make_response(False, "Could not process chat response", status_code=500, error=str(e))