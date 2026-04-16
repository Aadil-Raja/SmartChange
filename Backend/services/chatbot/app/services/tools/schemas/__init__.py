"""
Pydantic schemas for LLM structured outputs.

This module contains Pydantic models that enforce structured output
from LLMs using LangChain's with_structured_output() method.
"""

from .doc_qa_output import LLMDocQAOutput

__all__ = ["LLMDocQAOutput"]
