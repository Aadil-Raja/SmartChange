# app/routers/chathead_settings.py
"""
API endpoints for chathead settings (reranker model selection, etc.)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.models.chathead import ChatHead
from app.utils.response_utils import make_response

router = APIRouter()


class UpdateRerankerRequest(BaseModel):
    use_deep_reranker: bool


@router.patch("/{chathead_id}/reranker", status_code=status.HTTP_200_OK)
def update_chathead_reranker(
    chathead_id: int,
    request: UpdateRerankerRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Update the reranker model setting for a chathead.
    
    Args:
        chathead_id: ID of the chathead to update
        use_deep_reranker: True for deep model (jina-reranker-v3), False for fast model (ms-marco)
    """
    user_id = int(user)
    
    # Get chathead and verify ownership
    chathead = db.query(ChatHead).filter(
        ChatHead.id == chathead_id,
        ChatHead.user_id == user_id
    ).first()
    
    if not chathead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chathead not found or you don't have permission to modify it"
        )
    
    # Update the reranker setting
    chathead.use_deep_reranker = request.use_deep_reranker
    db.commit()
    db.refresh(chathead)
    
    model_name = "Deep (jina-reranker-v3)" if request.use_deep_reranker else "Fast (ms-marco-MiniLM)"
    
    return make_response(
        True,
        f"Reranker model updated to {model_name}",
        data={
            "chathead_id": chathead_id,
            "use_deep_reranker": chathead.use_deep_reranker,
            "model_name": model_name
        },
        status_code=200
    )


@router.get("/{chathead_id}/reranker", status_code=status.HTTP_200_OK)
def get_chathead_reranker(
    chathead_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get the current reranker model setting for a chathead.
    """
    user_id = int(user)
    
    # Get chathead and verify ownership
    chathead = db.query(ChatHead).filter(
        ChatHead.id == chathead_id,
        ChatHead.user_id == user_id
    ).first()
    
    if not chathead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chathead not found or you don't have permission to access it"
        )
    
    model_name = "Deep (jina-reranker-v3)" if chathead.use_deep_reranker else "Fast (ms-marco-MiniLM)"
    
    return make_response(
        True,
        "OK",
        data={
            "chathead_id": chathead_id,
            "use_deep_reranker": chathead.use_deep_reranker,
            "model_name": model_name
        },
        status_code=200
    )
