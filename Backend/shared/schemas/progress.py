# shared/schemas/training_employee.py
from pydantic import BaseModel, Field
from typing import Optional


class ProgressUpdateIn(BaseModel):
    progress: float = Field(default=0.0, ge=0.0, le=100.0, description="Progress percentage (0-100)")
    completed: Optional[bool] = Field(default=None, description="Explicitly mark as completed")