from app.services.storage_local import save_bytes

def upload_document_local(*, user_id: int, file_bytes: bytes, filename: str) -> dict:
    saved_path = save_bytes(file_bytes, user_id=user_id, original_name=filename)
    return {
        "ok": True,
        "saved_path": saved_path,
        "filename": filename,
        "user_id": user_id,
    }
