# NOW: RQ client wrapper used by the API to enqueue background jobs into Redis.
# FUTURE: Swap this out (same interface) for Celery/SQS/etc. without touching your services.

import os
import sys
import multiprocessing.context as _mp_ctx

# Windows doesn't support 'fork' — patch before rq imports to avoid ValueError in rq.scheduler
if sys.platform == "win32" and "fork" not in _mp_ctx._concrete_contexts:
    _mp_ctx._concrete_contexts["fork"] = _mp_ctx._concrete_contexts["spawn"]

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
        # job_timeout uses SIGALRM which doesn't exist on Windows — use -1 (no timeout) on win32
        timeout = -1 if sys.platform == "win32" else int(os.getenv("RQ_JOB_TIMEOUT", "600"))
        job = self.queue.enqueue(
            task_name,
            **kwargs,
            job_timeout=timeout,
            result_ttl=int(os.getenv("RQ_RESULT_TTL", "86400")),
            failure_ttl=int(os.getenv("RQ_FAILURE_TTL", "604800")),
            ttl=int(os.getenv("RQ_TTL", "86400")),
        )
        return job.id
