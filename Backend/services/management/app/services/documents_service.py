# app/services/documents_service.py
from app.repositories import documents_repo
from app.services.storage.storage_local import save_bytes
from shared.models import DocStatus


def upload_document_local(
    db,
    *,
    user_id: int,
    file_bytes: bytes,
    filename: str,
    mime: str | None = None,
    title: str | None = None,
):
    # 1) store bytes to disk
    storage_key = save_bytes(
        file_bytes,
        user_id=user_id,
        original_name=filename,
    )

    # 2) create DB row
    doc = documents_repo.create_document(
        db,
        title=title or filename,
        original_filename=filename,
        storage_key=storage_key,
        mime_type=mime or "application/octet-stream",
        size_bytes=len(file_bytes),
        uploaded_by=user_id,
        status=DocStatus.STORED,
    )

    return {
        "ok": True,
        "document_id": doc.id,
        "title": doc.title,
        "storage_key": doc.storage_key,
        "status": doc.status.value,
        "mime_type": doc.mime_type,
        "size_bytes": doc.size_bytes,
    }
