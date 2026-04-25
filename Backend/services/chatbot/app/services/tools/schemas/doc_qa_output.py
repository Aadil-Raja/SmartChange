"""
Structured output schema for document Q&A tool.

This schema enforces the LLM to return properly formatted responses
with answer, contradiction detection, and chunk citations with highlight snippets.
"""

from pydantic import BaseModel, Field
from typing import List


class ChunkCitation(BaseModel):
    """
    Citation for a single chunk with highlight snippets.
    
    Attributes:
        chunk_id: The CHUNK_ID string (format: "DOC{id}_CHUNK{index}")
        highlight_snippets: List of exact text phrases (5-20 words each) from this chunk
                           that directly answer the question. These will be highlighted
                           in yellow on the PDF for the user.
    
    Example:
        >>> citation = ChunkCitation(
        ...     chunk_id="DOC5_CHUNK2",
        ...     highlight_snippets=["CGPA is 3.99 out of 4.0", "graduated in 2024"]
        ... )
    """
    
    chunk_id: str = Field(
        description="The CHUNK_ID (e.g., 'DOC5_CHUNK2') that contains the cited information"
    )
    
    highlight_snippets: List[str] = Field(
        description=(
            "List of EXACT text phrases (5-20 words each) from this chunk that directly "
            "answer the question. Copy the text EXACTLY as it appears in the chunk. "
            "These phrases will be highlighted in yellow for the user. "
            "Limit to 2-3 most important phrases per chunk."
        )
    )


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
        
        citations: List of ChunkCitation objects, each containing a chunk_id and
                  the exact text snippets from that chunk that answer the question.
    
    Example:
        >>> output = LLMDocQAOutput(
        ...     answer="Aadil Raja's CGPA is 3.99 out of 4.0.",
        ...     has_contradiction=False,
        ...     citations=[
        ...         ChunkCitation(
        ...             chunk_id="DOC5_CHUNK2",
        ...             highlight_snippets=["CGPA is 3.99 out of 4.0"]
        ...         )
        ...     ]
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
    
    citations: List[ChunkCitation] = Field(
        description=(
            "List of citations, one per chunk used. Each citation must include:\n"
            "1. chunk_id: The CHUNK_ID of the chunk\n"
            "2. highlight_snippets: 2-3 EXACT text phrases (5-20 words) from that chunk "
            "that directly answer the question. Copy text EXACTLY as it appears.\n\n"
            "Do NOT include chunks used only for background context."
        )
    )
    
    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "examples": [
                {
                    "answer": "Aadil Raja's CGPA is 3.99 out of 4.0.",
                    "has_contradiction": False,
                    "citations": [
                        {
                            "chunk_id": "DOC5_CHUNK2",
                            "highlight_snippets": ["CGPA is 3.99 out of 4.0", "Final Semester"]
                        }
                    ]
                },
                {
                    "answer": "Note: Documents contradict each other — Resume.pdf states 3.99 GPA while Transcript.pdf states 3.85 GPA.",
                    "has_contradiction": True,
                    "citations": [
                        {
                            "chunk_id": "DOC5_CHUNK2",
                            "highlight_snippets": ["GPA: 3.99"]
                        },
                        {
                            "chunk_id": "DOC7_CHUNK1",
                            "highlight_snippets": ["Cumulative GPA: 3.85"]
                        }
                    ]
                }
            ]
        }
