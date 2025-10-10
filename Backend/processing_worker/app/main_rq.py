import os
import sys

# CRITICAL: Set Python path BEFORE any imports
# This ensures RQ can find all modules including processing_worker
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

print(f"[Worker Init] Backend directory: {backend_dir}")
print(f"[Worker Init] Python path: {sys.path[0]}")
print(f"[Worker Init] Current working directory: {os.getcwd()}")

import redis
from rq import Queue, Worker
from rq.worker import SimpleWorker

def main():
    queue_name = os.getenv("QUEUE_NAME", "docs")
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

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