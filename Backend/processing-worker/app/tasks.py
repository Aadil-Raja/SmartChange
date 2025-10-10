import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from PyPDF2 import PdfReader

from shared.models.document import Document, DocStatus  # adjust if your path differs

DATABASE_URL = os.getenv("DATABASE_URL")

_engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
_SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)

def _count_pdf_pages(path: str) -> int:
    try:
        with open(path, "rb") as f:
            reader = PdfReader(f)
            return len(reader.pages)
    except Exception:
        return -1

def process_document(document_id: int):
    """
    Minimal pipeline:
    - mark PROCESSING
    - if PDF, count pages (not stored yet; you can add a meta column later)
    - mark PROCESSED (or FAILED)
    """
    db = _SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        doc.status = DocStatus.PROCESSING
        db.commit()

        if (doc.mime_type or "").lower() == "application/pdf":
            _ = _count_pdf_pages(doc.storage_key)

        doc.status = DocStatus.PROCESSED
        db.commit()
    except Exception:
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = DocStatus.FAILED
                db.commit()
        finally:
            raise
    finally:
        db.close()
