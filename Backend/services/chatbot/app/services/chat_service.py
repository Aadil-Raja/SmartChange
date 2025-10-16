# app/services/chat_service.py
from sqlalchemy.orm import Session
from app.repositories import chat_repo
from app.services.agent_service import DocumentAgent
import sys, traceback

def ensure_chathead(db: Session, *, user_id: int, chathead_id: int | None, title: str | None) -> int:
    print(f"[ensure_chathead] user_id={user_id}, chathead_id={chathead_id}, title={title}", file=sys.stderr)
    if chathead_id is not None:
        chat = chat_repo.get_chathead(db, chathead_id)
        print(f"[ensure_chathead] loaded chat: {chat}", file=sys.stderr)
        if chat is None:
            raise PermissionError("Chat not found")
        if chat.user_id != user_id:
            raise PermissionError("Access denied")
        return chat.id

    chat = chat_repo.create_chathead(db, user_id=user_id, title=title)
    db.flush()
    print(f"[ensure_chathead] created new chat id={chat.id}", file=sys.stderr)
    return chat.id

def respond_turn(
    db: Session,
    chunk_db: Session,
    *,
    user_id: int,
    chathead_id: int | None,
    active_doc_id: int,
    message: str,
    title: str | None = None
) -> dict:
    try:
        print(f"[respond_turn] start user_id={user_id} chathead_id={chathead_id} doc={active_doc_id}", file=sys.stderr)
        cid = ensure_chathead(db, user_id=user_id, chathead_id=chathead_id, title=title)

        print("[respond_turn] saving user message", file=sys.stderr)
        chat_repo.add_message(db, chathead_id=cid, role="user", message=message, active_doc_id=active_doc_id)

        print("[respond_turn] running agent", file=sys.stderr)
        agent = DocumentAgent(db, chunk_db)
        out = agent.get_response(active_doc_id=active_doc_id, user_message=message)
        print(f"[respond_turn] agent result keys={list(out.keys())}", file=sys.stderr)

        print("[respond_turn] saving assistant message", file=sys.stderr)
        chat_repo.add_message(db, chathead_id=cid, role="assistant", message=out["answer"], active_doc_id=active_doc_id)

        db.commit()
        print("[respond_turn] committed", file=sys.stderr)
        return {"chathead_id": cid, "answer": out["answer"]}

    except Exception:
        traceback.print_exc()
        raise
