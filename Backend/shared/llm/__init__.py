"""
Shared LLM Provider Abstraction
Allows switching between different LLM providers (Gemini, OpenAI, etc.)
"""

from .factory import get_llm_provider
from .base import BaseLLMProvider

__all__ = ["get_llm_provider", "BaseLLMProvider"]
