"""
Structured output schema for document Q&A tool.

This schema enforces the LLM to return properly formatted responses
with answer, contradiction detection, and chunk ID citations.
"""

from pydantic import BaseModel, Field
from typing import List


class LLMDocQAOutput(BaseModel):
    """
    Structured output schema for doc_qa_tool_v2 LLM responses.
    
    This schema is used with LangChain's with_structured_output() to ensure
    the LLM always returns data in the correct format, eliminating JSON
    parsing errors and prompt-based format enforcement.
    
    Attributes:
        answer: The complete answer to the user's question, synthesized from
                retrieved document chunks. Should integrate information from
                multiple sources naturally.
        
        has_contradiction: Boolean flag indicating whether the retrieved documents
                          contain contradictory information on the same topic.
                          If True, the answer should explicitly note the contradiction.
        
        used_chunk_ids: List of CHUNK_ID strings (format: "DOC{id}_CHUNK{index}")
                       that directly contain facts used to answer the question.
                       Should NOT include chunks used only for background context.
    
    Example:
        >>> output = LLMDocQAOutput(
        ...     answer="The refund policy allows returns within 30 days.",
        ...     has_contradiction=False,
        ...     used_chunk_ids=["DOC5_CHUNK2", "DOC5_CHUNK4"]
        ... )
    """
    
    answer: str = Field(
        description=(
            "The complete answer to the user's question. "
            "Integrate information from multiple sources naturally. "
            "If documents contradict, explicitly note: "
            "'Note: Documents contradict each other — [Doc A] states X while [Doc B] states Y.'"
        )
    )
    
    has_contradiction: bool = Field(
        description=(
            "True if retrieved documents contain contradictory information "
            "on the same topic. False otherwise."
        )
    )
    
    used_chunk_ids: List[str] = Field(
        description=(
            "List of CHUNK_ID strings (e.g., 'DOC5_CHUNK2') that directly "
            "contain the specific facts used to answer the question. "
            "Do NOT include chunks used only for background context or general framing. "
            "Only include chunks that directly answer the question."
        )
    )
    
    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "examples": [
                {
                    "answer": "The refund policy allows returns within 30 days with a receipt.",
                    "has_contradiction": False,
                    "used_chunk_ids": ["DOC5_CHUNK2", "DOC5_CHUNK4"]
                },
                {
                    "answer": "Note: Documents contradict each other — Resume.pdf states 3.99 GPA while Transcript.pdf states 3.85 GPA.",
                    "has_contradiction": True,
                    "used_chunk_ids": ["DOC5_CHUNK2", "DOC7_CHUNK1"]
                }
            ]
        }
