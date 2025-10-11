import os
import sys

# ---- Load .env early (for QUEUE_NAME, REDIS_URL, etc.) ----
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())  # loads nearest .env (repo root recommended)
except Exception:
    pass  # optional: keep running even if python-dotenv is not installed

# ---- Make sure Python can import project packages ----
# <this file> = .../Backend/processing_worker/app/main_rq.py



import redis
from rq import Queue, Worker
from rq.worker import SimpleWorker


def main():
    queue_name = os.getenv("QUEUE_NAME")
    redis_url  = os.getenv("REDIS_URL")

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
