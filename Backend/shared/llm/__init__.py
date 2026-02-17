"""
Shared LLM Provider Abstraction
Allows switching between different LLM providers (Gemini, OpenAI, etc.)
Includes utilities for API key selection and embedding generation.
"""

from .factory import get_llm_provider
from .base import BaseLLMProvider
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider
from .utils import (
    get_llm_api_key,
    create_llm_provider,
    normalize_embeddings,
    embed_single,
)

__all__ = [
    "BaseLLMProvider",
    "get_llm_provider",
    "GeminiProvider",
    "OpenAIProvider",
    "get_llm_api_key",
    "create_llm_provider",
    "normalize_embeddings",
    "embed_single",
]
