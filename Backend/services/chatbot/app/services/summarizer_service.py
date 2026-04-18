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
N = 4  # Trigger summarization every N messages, and keep last N messages as verbatim history
MAX_SUMMARY_TOKENS = 1000  # Maximum tokens allowed in summary

settings = get_settings()


def should_trigger_summarization(db: Session, chathead_id: int) -> bool:
    """
    Check if we should trigger summarization.
    Triggers every N messages.
    """
    total_messages = chat_repo.count_total_messages(db, chathead_id)
    
    # Need at least N messages to have something to summarize
    if total_messages < N:
        return False
    
    # Trigger every N messages (at 4, 8, 12, etc.)
    return total_messages % N == 0


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
        # For each active doc, update its summary
        for doc_id in active_doc_ids:
            try:
                _update_summary_for_doc(
                    db,
                    management_db,
                    chathead_id,
                    doc_id
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
    doc_id: int
):
    """Update summary for a single document using incremental approach."""
    # Get existing summary
    existing_summary_obj = chat_repo.get_summary(db, chathead_id, doc_id)
    existing_summary = existing_summary_obj.summary if existing_summary_obj else None
    last_summarized_message_id = existing_summary_obj.last_summarized_message_id if existing_summary_obj else None
    
    # Get ALL messages (not excluding last N - that's for the agent's verbatim window)
    all_messages = chat_repo.get_all_messages(
        db,
        chathead_id=chathead_id
    )
    
    # Filter to get only NEW messages since last summarization
    if last_summarized_message_id:
        # Incremental: only get new messages since last summarization
        messages_to_summarize = [
            msg for msg in all_messages
            if msg.id > last_summarized_message_id
        ]
    else:
        # First time: use all messages
        messages_to_summarize = all_messages
    
    if not messages_to_summarize:
        return
    
    # Filter messages for this doc
    doc_messages = [
        msg for msg in messages_to_summarize
        if msg.active_doc_ids and doc_id in msg.active_doc_ids
    ]
    
    if not doc_messages:
        return
    
    # Log summarization event
    print(f"\n{'='*80}", file=sys.stderr)
    print(f"[SUMMARIZATION] Chathead {chathead_id}, Doc {doc_id}", file=sys.stderr)
    print(f"[SUMMARIZATION] Last summarized message ID: {last_summarized_message_id}", file=sys.stderr)
    print(f"[SUMMARIZATION] Messages to summarize: {len(doc_messages)} messages", file=sys.stderr)
    print(f"[SUMMARIZATION] Message IDs: {[msg.id for msg in doc_messages]}", file=sys.stderr)
    
    # Get doc title
    doc = documents_repo.get_by_id(management_db, doc_id)
    doc_title = doc.title if doc else f"Document {doc_id}"
    
    # Format messages for LLM
    formatted_messages = []
    for msg in doc_messages:
        role_str = "User" if msg.role == MessageRole.USER else "Assistant"
        formatted_messages.append(f"{role_str}: {msg.message}")
    messages_text = "\n\n".join(formatted_messages)
    
    # Build prompt with strict token limit instruction
    existing_block = f"Previous summary:\n{existing_summary}\n\n" if existing_summary else ""
    
    prompt = f"""Summarize this conversation with a document assistant. Be extremely concise.

Document: {doc_title}

{existing_block}New exchanges:
{messages_text}

Rules:
- Max {MAX_SUMMARY_TOKENS} tokens total (hard limit)
- One sentence per exchange: what was asked, what was answered
- Past tense, third person
- No elaboration, no background, just the factual core
- If a previous summary exists, append new info only — do not rewrite

Summary:"""
    
    # Call LLM
    from shared.llm import create_llm_provider
    
    llm = create_llm_provider(
        llm_provider=settings.llm_provider,
        llm_model=settings.llm_model,
        google_api_key=settings.google_api_key,
        openai_api_key=settings.openai_api_key
    )
    
    new_summary = llm.generate(prompt)
    
    # Get the ID of the last message we just summarized FOR THIS DOC
    last_message_id = doc_messages[-1].id
    
    print(f"[SUMMARIZATION] New summary generated (last message ID: {last_message_id})", file=sys.stderr)
    print(f"[SUMMARIZATION] Summary: {new_summary[:200]}...", file=sys.stderr)
    print(f"{'='*80}\n", file=sys.stderr)
    
    # Save summary with tracking
    chat_repo.upsert_summary(
        db,
        chathead_id=chathead_id,
        doc_id=doc_id,
        summary=new_summary,
        last_summarized_message_id=last_message_id
    )
