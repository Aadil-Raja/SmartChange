from sqlalchemy.orm import Session
from app.repositories import external_link_repo
from shared.schemas.training_admin import LinkCreate
from shared.schemas.training_admin import LinkUpdate

def create_link(db: Session, *, admin_id: int, body: LinkCreate):
    """
    Creates a new external link record in the database.
    """
    if not body.title or not body.url:
        raise ValueError("Title and URL are required.")

    link = external_link_repo.create_link(
        db,
        title=body.title,
        url=str(body.url),
        uploaded_by=admin_id
    )

    return {
        "id": link.id,
        "title": link.title,
        "url": link.url,
        "created_at": link.created_at
    }

def list_links(db: Session):
    rows = external_link_repo.list_links(db)
    return [{"id": r.id, "title": r.title, "url": r.url, "created_at": r.created_at} for r in rows]

def get_link_by_id(db: Session, link_id: int):
    row = external_link_repo.get_link(db, link_id)
    if not row:
        raise ValueError(f"Link with id {link_id} not found")
    return {
        "id": row.id,  
        "title": row.title,
        "url": row.url,
        "created_at": row.created_at            
    }

def update_link(db: Session, *, link_id: int, body: LinkUpdate):
    if body.title is None and body.url is None:
        raise ValueError("Provide at least one field to update (title or url).")

    link = external_link_repo.update_link(
        db,
        link_id=link_id,
        title=body.title,
        url=str(body.url) if body.url is not None else None,
    )
    if not link:
        raise ValueError("Link not found")

    return {
        "link": {
            "id": link.id,
            "title": link.title,
            "url": link.url,
            "created_at": link.created_at,
            "updated_at": link.updated_at,
        }
    }

def delete_link(db: Session, *, link_id: int):
    from shared.models.course_content import ContentItem
    link = external_link_repo.get_link(db, link_id)
    if not link:
        raise ValueError("Link not found")

    # Block if referenced by any course content item
    ref_count = db.query(ContentItem.id).filter(ContentItem.external_link_id == link_id).count()
    if ref_count > 0:
        raise ValueError(
            f"Cannot delete — this link is used in {ref_count} course content item{'s' if ref_count != 1 else ''}. "
            "Remove it from all courses first."
        )

    external_link_repo.delete_link(db, link_id)
    return {"deleted": True}