from fastapi import APIRouter, Depends, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.deps.db import get_db, get_management_db
from app.services import chat_service
from app.services import chat_service_v2
from app.services import summarizer_service
from app.repositories import chat_repo
from app.schemas import ChatTurnIn
from app.schemas.chat import ChatTurnOutV2
from app.utils.response_utils import make_response
from app.deps.auth import get_current_user
import sys

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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    management_db: Session = Depends(get_management_db),
    user=Depends(get_current_user),
):
    """
    V2 endpoint - returns structured response with citations.
    Response includes: chathead_id, answer, has_contradiction, citations[].
    Each citation has: doc_id, doc_title, page, section, snippet.
    
    Triggers background summarization every 10 messages.
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
        
        # Check if should trigger summarization
        if summarizer_service.should_trigger_summarization(db, result["chathead_id"]):
            background_tasks.add_task(
                summarizer_service.update_summaries,
                db=db,
                management_db=management_db,
                chathead_id=result["chathead_id"],
                active_doc_ids=payload.active_doc_ids
            )
        
        return make_response(True, "OK", data=result, status_code=200)

    except Exception as e:
        return make_response(False, "Could not process chat response", status_code=500, error=str(e))