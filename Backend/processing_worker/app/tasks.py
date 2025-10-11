import os

# ---- Load .env early so DATABASE_URL is available ----
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())
except Exception:
    pass

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from PyPDF2 import PdfReader

# ⚠️ Ensure this import path matches your actual file: shared/models/document.py
from shared.models.Document import Document, DocStatus


DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Set it in .env or the environment.")

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
    - if PDF, count pages
    - mark PROCESSED (or FAILED)
    - return a dict so RQ stores it in job.result
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

        return {"ok": True, "document_id": doc.id, "page_count": pages}

    except Exception:
        try:
            # best-effort failure mark
            doc = locals().get("doc")
            if doc:
                doc.status = DocStatus.FAILED
                db.commit()
        finally:
            raise
    finally:
        db.close()
