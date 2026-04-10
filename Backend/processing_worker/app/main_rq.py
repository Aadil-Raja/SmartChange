import os
import sys
import logging
import multiprocessing.context as _mp_ctx

# Windows doesn't support 'fork' — patch before rq imports
if sys.platform == "win32" and "fork" not in _mp_ctx._concrete_contexts:
    _mp_ctx._concrete_contexts["fork"] = _mp_ctx._concrete_contexts["spawn"]

import redis
from rq import Queue, Worker
from rq.worker import SimpleWorker

from core.config import get_settings

VERBOSE_LOGGING = False

logging.basicConfig(
    level=logging.DEBUG if VERBOSE_LOGGING else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
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
        worker.work(with_scheduler=False)
    else:
        print("[Worker] Using Worker (Unix/Linux)")
        worker = Worker([q], connection=conn)
        worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
