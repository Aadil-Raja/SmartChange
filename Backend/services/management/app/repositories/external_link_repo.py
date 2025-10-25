from sqlalchemy.orm import Session
from sqlalchemy import desc
from shared.models.external_link import ExternalLink

def create_link(db: Session, *, title: str, url: str, uploaded_by: int):
    link = ExternalLink(title=title, url=url, uploaded_by=uploaded_by)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link

def list_links(db: Session):
    return db.query(ExternalLink).order_by(desc(ExternalLink.created_at)).all()

def get_link(db: Session, link_id: int):
    return db.query(ExternalLink).filter(ExternalLink.id == link_id).first()


def update_link(
    db: Session,
    *,
    link_id: int,
    title: str | None = None,
    url: str | None = None,
) -> ExternalLink | None:
    link = get_link(db, link_id)
    if not link:
        return None
    if title is not None:
        link.title = title
    if url is not None:
        link.url = url
    db.add(link)
    db.commit()
    db.refresh(link)
    return link

def delete_link(db: Session, link_id: int) -> bool:
    link = get_link(db, link_id)
    if not link:
        return False
    db.delete(link)
    db.commit()
    return True