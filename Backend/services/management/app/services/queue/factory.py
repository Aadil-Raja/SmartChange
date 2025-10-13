# NOW: Chooses the queue backend (RQ) and returns a client instance.
# FUTURE: Add Celery/SQS/Kafka adapters here and switch via .env without code changes.

from .rq_queue import RQClient
from app.core.config import get_settings

settings = get_settings()

def get_queue():
    if settings.queue_backend == "rq":
        # Pass both redis_url and queue_name explicitly
        return RQClient(
            redis_url=settings.redis_url,
            queue_name=settings.queue_name
        )
    raise ValueError(f"Unsupported QUEUE_BACKEND={settings.queue_backend}")
