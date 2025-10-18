from pydantic import BaseModel, Field
from typing import Optional

class ChatTurnIn(BaseModel):
    """
    Single payload for both first and subsequent turns.
    - If chathead_id is None/missing => create a chathead (optionally use title)
    - If chathead_id is provided     => continue that chat
    """
    message: str = Field(..., min_length=1, description="User's message text")
    active_doc_id: int = Field(..., ge=1, description="Selected document ID for this turn")
    chathead_id: Optional[int] = Field(default=None, ge=1, description="Existing chathead to continue")
    title: Optional[str] = Field(default=None, description="Optional title (used only when creating a new chat)")

class ChatRenameIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)