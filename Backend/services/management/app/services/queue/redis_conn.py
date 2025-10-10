import os, redis
def get_redis():
    return redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
