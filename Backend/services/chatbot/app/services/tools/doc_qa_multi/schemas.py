# app/services/tools/doc_qa_multi/schemas.py
"""
Pydantic models for multi-doc QA structured outputs.
"""
from pydantic import BaseModel, Field
from typing import List


class SubQuestion(BaseModel):
    """A sub-question targeting specific documents."""
    question: str = Field(description="The sub-question text")
    doc_ids: List[int] = Field(description="Document IDs this question targets")


class DecomposedQuestions(BaseModel):
    """Result of question decomposition analysis."""
    is_cross_doc: bool = Field(description="Whether the question spans multiple documents")
    confidence: float = Field(description="Confidence score 0.0-1.0 for the decomposition")
    sub_questions: List[SubQuestion] = Field(default_factory=list, description="Decomposed sub-questions")


class SubAnswer(BaseModel):
    """Answer to a single sub-question."""
    question: str = Field(description="The sub-question that was answered")
    doc_ids: List[int] = Field(description="Documents used for this answer")
    answer: str = Field(description="The answer text")
    citations: List[dict] = Field(default_factory=list, description="Citations for this answer")
    # retrieved_contexts removed - now using side channel
    has_contradiction: bool = Field(default=False, description="Whether contradictions were found")
    failed: bool = Field(default=False, description="Whether retrieval failed")
    error_note: str = Field(default="", description="Error message if failed")
    tokens_input: int = Field(default=0, description="Input tokens used")
    tokens_output: int = Field(default=0, description="Output tokens used")


class MergedAnswer(BaseModel):
    """Final merged answer from multiple sub-answers."""
    answer: str = Field(description="Final merged answer text")
    has_contradiction: bool = Field(description="Overall contradiction flag")
    citations: List[dict] = Field(default_factory=list, description="Deduplicated citations")
    # retrieved_contexts removed - now using side channel
    tokens_input: int = Field(default=0, description="Total input tokens")
    tokens_output: int = Field(default=0, description="Total output tokens")
