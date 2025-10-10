import os
from .rq_queue import RQClient

def get_queue():
    backend = os.getenv("QUEUE_BACKEND", "rq").lower()
    if backend == "rq":
        return RQClient()
    raise ValueError(f"Unsupported QUEUE_BACKEND={backend}")
