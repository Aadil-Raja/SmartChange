class QueueClient:
    def enqueue(self, task_name: str, **kwargs) -> str:
        raise NotImplementedError
