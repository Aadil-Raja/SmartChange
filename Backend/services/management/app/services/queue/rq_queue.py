# NOW: RQ client wrapper used by the API to enqueue background jobs into Redis.
# FUTURE: Swap this out (same interface) for Celery/SQS/etc. without touching your services.

import os
from rq import Queue
import redis
from app.core.config import get_settings

settings = get_settings()

class RQClient:
    def __init__(self, *, redis_url: str, queue_name: str):
        """Initialize RQ client with Redis connection and queue name."""
        self.redis_url = redis_url
        self.queue_name = queue_name
        self.conn = redis.from_url(self.redis_url)
        self.queue = Queue(self.queue_name, connection=self.conn)

    def enqueue(self, task_name: str, **kwargs) -> str:
        """Enqueue a background job into the RQ queue."""
        job = self.queue.enqueue(
            task_name,
            **kwargs,
            job_timeout=int(os.getenv("RQ_JOB_TIMEOUT", "600")),
            result_ttl=int(os.getenv("RQ_RESULT_TTL", "86400")),
            failure_ttl=int(os.getenv("RQ_FAILURE_TTL", "604800")),
            ttl=int(os.getenv("RQ_TTL", "86400")),
        )
        return job.id
