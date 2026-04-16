# app/services/summarizer_service.py
"""
Background service for generating and updating document-wise conversation summaries.
"""
from sqlalchemy.orm import Session
from typing import List
import sys
from app.repositories import chat_repo
from shared.repos import documents_repo
from app.models import MessageRole
from app.core.config import get_settings

# Configuration
SUMMARIZE_EVERY_N_MESSAGES = 2   # Trigger every 4 messages
LAST_N_MESSAGES_VERBATIM = 2     # Keep last 2 messages verbatim (not summarized)

settings = get_settings()


def should_trigger_summarization(db: Session, chathead_id: int) -> bool:
    """
    Check if we should trigger summarization.
    Triggers every 10 messages.
    """
    total_messages = chat_repo.count_total_messages(db, chathead_id)
    
    # Need at least N+1 messages to have something to summarize
    if total_messages < (LAST_N_MESSAGES_VERBATIM + 1):
        return False
    
    # Trigger every 10 messages
    return total_messages % SUMMARIZE_EVERY_N_MESSAGES == 0


def update_summaries(
    db: Session,
    management_db: Session,
    chathead_id: int,
    active_doc_ids: List[int]
):
    """
    Background task to update summaries for active documents.
    
    CRITICAL: This function MUST NEVER raise exceptions - it runs in background.
    All errors are logged and swallowed.
    """
    try:
        # Get all messages except last N
        messages_to_summarize = chat_repo.get_all_messages_except_last_n(
            db,
            chathead_id=chathead_id,
            exclude_last_n=LAST_N_MESSAGES_VERBATIM
        )
        
        if not messages_to_summarize:
            return
        
        # For each active doc, update its summary
        for doc_id in active_doc_ids:
            try:
                _update_summary_for_doc(
                    db,
                    management_db,
                    chathead_id,
                    doc_id,
                    messages_to_summarize
                )
            except Exception:
                import traceback
                traceback.print_exc(file=sys.stderr)
                continue  # Never crash - continue with other docs
        
        db.commit()
        
    except Exception:
        import traceback
        traceback.print_exc(file=sys.stderr)
        # Swallow exception - background task must never crash


def _update_summary_for_doc(
    db: Session,
    management_db: Session,
    chathead_id: int,
    doc_id: int,
    all_messages: List
):
    """Update summary for a single document."""
    # Filter messages for this doc
    doc_messages = [
        msg for msg in all_messages
        if msg.active_doc_ids and doc_id in msg.active_doc_ids
    ]
    
    if not doc_messages:
        return
    
    # Get existing summary
    existing_summary_obj = chat_repo.get_summary(db, chathead_id, doc_id)
    existing_summary = existing_summary_obj.summary if existing_summary_obj else None
    
    # Get doc title
    doc = documents_repo.get_by_id(management_db, doc_id)
    doc_title = doc.title if doc else f"Document {doc_id}"
    
    # Format messages for LLM
    formatted_messages = []
    for msg in doc_messages:
        role_str = "User" if msg.role == MessageRole.USER else "Assistant"
        formatted_messages.append(f"{role_str}: {msg.message}")
    messages_text = "\n\n".join(formatted_messages)
    
    # Build prompt
    existing_block = f"Previous summary:\n{existing_summary}\n\n" if existing_summary else ""
    
    prompt = f"""You are summarizing a conversation between a user and a document assistant.

Document: {doc_title}

{existing_block}New exchanges to incorporate:
{messages_text}

Instructions:
- Write a 2-3 sentence summary maximum
- Only capture: what topic the user asked about, and the key fact/answer given
- Skip background context, history, or elaboration — just the core exchange
- Write in past tense, third person
- If there's a previous summary, append new info in 1 sentence, do not rewrite it

Updated summary:"""
    
    # Call LLM
    from shared.llm import create_llm_provider
    
    llm = create_llm_provider(
        llm_provider=settings.llm_provider,
        llm_model=settings.llm_model,
        google_api_key=settings.google_api_key,
        openai_api_key=settings.openai_api_key
    )
    
    new_summary = llm.generate(prompt)  # Use generate() not generate_text()
    
    # Save summary
    chat_repo.upsert_summary(
        db,
        chathead_id=chathead_id,
        doc_id=doc_id,
        summary=new_summary
    )
