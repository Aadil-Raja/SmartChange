from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

class ChatTurnIn(BaseModel):
    """
    Single payload for both first and subsequent turns.
    - If chathead_id is None/missing => create a chathead (optionally use title)
    - If chathead_id is provided     => continue that chat
    
    active_doc_ids: List of document IDs (supports single or multiple documents)
    Examples:
    - Single document: active_doc_ids=[123]
    - Multiple documents: active_doc_ids=[123, 456, 789]
    """
    message: str = Field(..., min_length=1, description="User's message text")
    active_doc_ids: List[int] = Field(..., min_items=1, description="List of document IDs (can be single [123] or multiple [123, 456, 789])")
    chathead_id: Optional[int] = Field(default=None, ge=1, description="Existing chathead to continue")
    title: Optional[str] = Field(default=None, description="Optional title (used only when creating a new chat)")
    
    @field_validator('active_doc_ids')
    @classmethod
    def validate_doc_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one document ID is required")
        if len(v) > 10:
            raise ValueError("Maximum 10 documents allowed per chat")
        if len(v) != len(set(v)):
            raise ValueError("Duplicate document IDs not allowed")
        return v

class ChatRenameIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
