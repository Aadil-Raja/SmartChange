"""
Factory function to create LLM providers based on configuration.
"""

import logging
from typing import Optional, Dict, Any

from .base import BaseLLMProvider
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)


def get_llm_provider(
    provider: str,
    api_key: str,
    model: str,
    **kwargs
) -> BaseLLMProvider:
    """
    Factory function to create the appropriate LLM provider.
    
    Args:
        provider: Provider name ('gemini' or 'openai')
        api_key: API key for the provider
        model: Model name/identifier
        **kwargs: Additional provider-specific configuration
        
    Returns:
        Initialized LLM provider instance
        
    Raises:
        ValueError: If provider is unknown or configuration is invalid
        
    Example:
        >>> llm = get_llm_provider(
        ...     provider="gemini",
        ...     api_key="your-api-key",
        ...     model="gemini-2.5-flash"
        ... )
        >>> response = llm.generate("What is AI?")
    """
    provider = provider.lower().strip()
    
    if not api_key:
        raise ValueError(f"API key is required for provider: {provider}")
    
    if not model:
        raise ValueError(f"Model name is required for provider: {provider}")
    
    if provider == "gemini":
        logger.info(f"Creating Gemini provider with model: {model}")
        return GeminiProvider(api_key=api_key, model=model, **kwargs)
    
    elif provider == "openai":
        logger.info(f"Creating OpenAI provider with model: {model}")
        return OpenAIProvider(api_key=api_key, model=model, **kwargs)
    
    else:
        raise ValueError(
            f"Unknown LLM provider: {provider}. "
            f"Supported providers: 'gemini', 'openai'"
        )


def get_api_key_for_provider(provider: str, google_api_key: Optional[str] = None, openai_api_key: Optional[str] = None) -> str:
    """
    Helper function to get the correct API key for a provider.
    
    Args:
        provider: Provider name ('gemini' or 'openai')
        google_api_key: Google API key (optional)
        openai_api_key: OpenAI API key (optional)
        
    Returns:
        The appropriate API key
        
    Raises:
        ValueError: If the required API key is not provided
    """
    provider = provider.lower().strip()
    
    if provider == "gemini":
        if not google_api_key:
            raise ValueError("Google API key is required for Gemini provider")
        return google_api_key
    
    elif provider == "openai":
        if not openai_api_key:
            raise ValueError("OpenAI API key is required for OpenAI provider")
        return openai_api_key
    
    else:
        raise ValueError(f"Unknown provider: {provider}")
