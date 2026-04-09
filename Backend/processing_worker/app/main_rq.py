import os
import sys
import logging

import redis
from rq import Queue, Worker
from rq.worker import SimpleWorker

from core.config import get_settings

# Set to True to enable DEBUG logging, False for WARNING (quiet)
VERBOSE_LOGGING = False

logging.basicConfig(
    level=logging.DEBUG if VERBOSE_LOGGING else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
# Suppress noisy RQ internal debug logs
logging.getLogger("rq").setLevel(logging.WARNING)


def main():
    settings = get_settings()
    queue_name = settings.queue_name
    redis_url = settings.redis_url

    print(f"[Worker] Queue name: {queue_name}")
    print(f"[Worker] Redis URL: {redis_url}")

    try:
        conn = redis.from_url(redis_url)
        print("[Worker] ✓ Connected to Redis")
    except Exception as e:
        print(f"[Worker] ✗ Failed to connect to Redis: {e}")
        sys.exit(1)

    q = Queue(queue_name, connection=conn)

    if os.name == "nt":
        print("[Worker] Using SimpleWorker (Windows - no fork)")
        worker = SimpleWorker([q], connection=conn)
    else:
        print("[Worker] Using Worker (Unix/Linux)")
        worker = Worker([q], connection=conn)

    print("[Worker] *** Listening for jobs ***")
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
