# app/repositories/documents_repo.py
from sqlalchemy.orm import Session
from sqlalchemy import func
from shared.models import Document, DocStatus ,User
from sqlalchemy import desc

def create_document(
    db: Session,
    *,
    title: str,
    original_filename: str,
    storage_key: str,
    mime_type: str,
    size_bytes: int,
    uploaded_by: int,
    status: DocStatus = DocStatus.STORED,
) -> Document:
    """
    Insert a single Document row after the file has been safely stored.
    Default status is STORED; adjust if you want PENDING→STORED flow.
    """
    doc = Document(
        title=title,
        original_filename=original_filename,
        storage_key=storage_key,
        mime_type=mime_type,
        size_bytes=size_bytes,
        status=status,
        uploaded_by=uploaded_by,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def get_document(db: Session, document_id: int) -> Document | None:
    return db.query(Document).filter(Document.id == document_id).first()


def list_documents(db: Session):
    """
    Return latest documents (newest first) joined with user email.
    """
    query = (
        db.query(
            Document,
            User.email.label("uploader_email")   # add uploader email
        )
        .join(User, User.id == Document.uploaded_by)            # inner join
        .order_by(desc(Document.created_at), desc(Document.id)) # newest first
    )

    return query.all()

def update_status(
    db: Session, *, document_id: int, status: DocStatus
) -> Document | None:
    """
    Update processing status (e.g., STORED → QUEUED → PROCESSING → PROCESSED/FAILED).
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return None
    doc.status = status
    # also bump updated_at if you want immediate timestamp change:
    doc.updated_at = func.now()
    db.commit()
    db.refresh(doc)
    return doc


def attach_cloudinary_fields(db: Session, *, document_id: int, url: str, public_id: str | None):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return None
    doc.cloudinary_url = url
    doc.cloudinary_public_id = public_id
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
