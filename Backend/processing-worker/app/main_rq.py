import os
import redis
from rq import Worker, Queue, Connection

def main():
    listen = [os.getenv("QUEUE_NAME", "docs")]
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    conn = redis.from_url(redis_url)

    with Connection(conn):
        worker = Worker([Queue(name) for name in listen])
        worker.work(with_scheduler=True)

if __name__ == "__main__":
    main()
