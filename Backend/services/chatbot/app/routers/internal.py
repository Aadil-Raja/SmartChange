from fastapi import APIRouter
from app.services import quota_cache

router = APIRouter()


@router.post("/quota/invalidate/{user_id}")
def invalidate_quota_cache(user_id: int):
    """
    Internal endpoint — called by management service after quota update/reset.
    Clears the in-memory cache so the next request reads fresh values from DB.
    Not exposed to frontend, no auth needed (internal network only).
    """
    quota_cache.invalidate(user_id)
    return {"invalidated": user_id}
