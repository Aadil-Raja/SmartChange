import os
from rq import Queue
import redis

class RQClient:
    def __init__(self, *, redis_url: str | None = None, queue_name: str | None = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.queue_name = queue_name or os.getenv("QUEUE_NAME", "docs")
        self.conn = redis.from_url(self.redis_url)
        self.queue = Queue(self.queue_name, connection=self.conn)

    def enqueue(self, task_name: str, **kwargs) -> str:
        job = self.queue.enqueue(
            task_name,
            **kwargs,
            job_timeout=int(os.getenv("RQ_JOB_TIMEOUT", "600")),
            result_ttl=int(os.getenv("RQ_RESULT_TTL", "86400")),
            failure_ttl=int(os.getenv("RQ_FAILURE_TTL", "604800")),
            ttl=int(os.getenv("RQ_TTL", "86400")),
        )
        return job.get_id()
