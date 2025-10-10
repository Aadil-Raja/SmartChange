# Backend/processing_worker/app/tasks.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from PyPDF2 import PdfReader

from shared.models.Document import Document, DocStatus  # use correct module name/case

# ⛔️ Don’t hardcode credentials in code. Prefer env/.env.
DATABASE_URL = ""
_engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
_SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)

def _count_pdf_pages(path: str) -> int:
    try:
        with open(path, "rb") as f:
            return len(PdfReader(f).pages)
    except Exception:
        return -1  # sentinel if unreadable

def process_document(document_id: int) -> dict:
    """
    - mark PROCESSING
    - count pages if PDF
    - mark PROCESSED (or FAILED)
    - RETURN the result so RQ stores it in job.result
    """
    db = _SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return {"ok": False, "error": "document_not_found"}

        doc.status = DocStatus.PROCESSING
        db.commit()

        pages = _count_pdf_pages(doc.storage_key) if (doc.mime_type or "").lower() == "application/pdf" else -1

        doc.status = DocStatus.PROCESSED
        db.commit()

        # ✅ This return populates job.result
        return {"ok": True, "document_id": doc.id, "page_count": pages}

    except Exception as e:
        try:
            if 'doc' in locals() and doc:
                doc.status = DocStatus.FAILED
                db.commit()
        finally:
            # Returning an error also shows up in job.exc_info
            raise
    finally:
        db.close()
