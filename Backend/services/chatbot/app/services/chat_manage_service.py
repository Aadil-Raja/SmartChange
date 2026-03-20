from sqlalchemy.orm import Session
from app.repositories import chat_repo

def list_heads(db: Session, *, user_id: int, limit: int, offset: int):
    rows, total = chat_repo.list_chatheads(db, user_id=user_id, limit=limit, offset=offset)
    # shape a simple response
   
    return {
        "total": total,
        "items": [
            {"id": r.id, "title": r.title, "created_at": r.created_at, "last_active_at": r.last_active_at}
            for r in rows
        ],
    }

def list_messages(db: Session, *, user_id: int, chathead_id: int, limit: int, before_id: int | None, after_id: int | None):
    chat = chat_repo.get_chathead(db, chathead_id)
    if not chat or chat.user_id != user_id:
        raise PermissionError("Chat not found or access denied")
    rows = chat_repo.get_messages_window(db, chathead_id=chathead_id, limit=limit, before_id=before_id, after_id=after_id)
    return {
        "chathead_id": chathead_id,
        "items": [
            {"id": m.id, "role": m.role, "message": m.message, "active_doc_ids": m.active_doc_ids, "created_at": m.created_at}
            for m in rows
        ],
    }

def rename_head(db: Session, *, user_id: int, chathead_id: int, title: str):
    chat = chat_repo.get_chathead(db, chathead_id)
    if not chat or chat.user_id != user_id:
        raise PermissionError("Chat not found or access denied")
    chat.title = title
    db.add(chat)
    db.commit()

def delete_head(db: Session, *, user_id: int, chathead_id: int):
    chat = chat_repo.get_chathead(db, chathead_id)
    if not chat or chat.user_id != user_id:
        raise PermissionError("Chat not found or access denied")
    db.delete(chat)  # ON DELETE CASCADE will remove messages if FK set; otherwise relationship cascade handles it
    db.commit()
