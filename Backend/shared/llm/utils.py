"""
LLM and Embedding Utilities
Shared helper functions for LLM provider initialization and embedding generation.
"""

import logging
from typing import List
import numpy as np
import google.generativeai as genai

from .factory import get_llm_provider
from .base import BaseLLMProvider

logger = logging.getLogger(__name__)


# ============================================================================
# LLM Provider Utilities
# ============================================================================

def get_llm_api_key(
    llm_provider: str,
    google_api_key: str | None = None,
    openai_api_key: str | None = None
) -> str:
    """
    Get the appropriate API key based on LLM provider.
    
    Args:
        llm_provider: Provider name ('gemini' or 'openai')
        google_api_key: Google API key (for Gemini)
        openai_api_key: OpenAI API key (for OpenAI)
        
    Returns:
        The appropriate API key
        
    Raises:
        ValueError: If the required API key is missing
        
    Example:
        >>> from shared.llm.utils import get_llm_api_key
        >>> api_key = get_llm_api_key("openai", openai_api_key=settings.openai_api_key)
    """
    provider = llm_provider.lower().strip()
    
    if provider == "gemini":
        if not google_api_key:
            raise ValueError("Google API key is required for Gemini provider")
        return google_api_key
    
    elif provider == "openai":
        if not openai_api_key:
            raise ValueError("OpenAI API key is required for OpenAI provider")
        return openai_api_key
    
    else:
        raise ValueError(
            f"Unknown LLM provider: {provider}. "
            f"Supported providers: 'gemini', 'openai'"
        )


def create_llm_provider(
    llm_provider: str,
    llm_model: str,
    google_api_key: str | None = None,
    openai_api_key: str | None = None,
    **kwargs
) -> BaseLLMProvider:
    """
    Create an LLM provider with automatic API key selection.
    Convenience wrapper around get_llm_provider() that handles API key selection.
    
    Args:
        llm_provider: Provider name ('gemini' or 'openai')
        llm_model: Model name
        google_api_key: Google API key (for Gemini)
        openai_api_key: OpenAI API key (for OpenAI)
        **kwargs: Additional provider configuration
        
    Returns:
        Initialized LLM provider
        
    Raises:
        ValueError: If configuration is invalid
        
    Example:
        >>> from shared.llm.utils import create_llm_provider
        >>> llm = create_llm_provider(
        ...     llm_provider=settings.llm_provider,
        ...     llm_model=settings.llm_model,
        ...     google_api_key=settings.google_api_key,
        ...     openai_api_key=settings.openai_api_key
        ... )
        >>> response = llm.generate("Hello")
    """
    # Get the appropriate API key
    api_key = get_llm_api_key(llm_provider, google_api_key, openai_api_key)
    
    # Create and return the provider
    return get_llm_provider(
        provider=llm_provider,
        api_key=api_key,
        model=llm_model,
        **kwargs
    )


# ============================================================================
# Embedding Utilities
# ============================================================================

def normalize_embeddings(embeddings: List[List[float]]) -> List[List[float]]:
    """
    Normalize embeddings to unit length for accurate cosine similarity.
    Required for 768 and 1536 dimensions according to Google's documentation.
    
    Args:
        embeddings: List of embedding vectors
        
    Returns:
        List of normalized embedding vectors
        
    Example:
        >>> from shared.llm.utils import normalize_embeddings
        >>> embeddings = [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]
        >>> normalized = normalize_embeddings(embeddings)
    """
    normalized = []
    for emb in embeddings:
        emb_array = np.array(emb)
        norm = np.linalg.norm(emb_array)
        if norm > 0:
            normalized_emb = (emb_array / norm).tolist()
        else:
            normalized_emb = emb  # Keep original if norm is 0
            logger.warning("Embedding norm is 0, keeping original")
        normalized.append(normalized_emb)
    return normalized


def embed_single(
    text: str,
    api_key: str,
    embedding_model: str = "models/gemini-embedding-001",
    task_type: str = "retrieval_query",
    output_dimensionality: int = 768,
    normalize: bool = True
) -> List[float]:
    """
    Generate embedding for a single text using Google Gemini.
    
    This function is shared across all services for consistent embedding generation.
    Embeddings are normalized to unit length for accurate cosine similarity.
    
    Args:
        text: Text to embed
        api_key: Google API key
        embedding_model: Gemini embedding model name (default: models/gemini-embedding-001)
        task_type: "retrieval_query" for queries, "retrieval_document" for documents
        output_dimensionality: Embedding dimension (768 or 1536)
        normalize: Whether to normalize to unit length (recommended for 768/1536)
        
    Returns:
        List of floats representing the embedding vector
        
    Raises:
        ValueError: If embedding generation fails or response format is unexpected
        
    Example:
        >>> from shared.llm.utils import embed_single
        >>> embedding = embed_single(
        ...     text="What is machine learning?",
        ...     api_key=settings.google_api_key,
        ...     embedding_model=settings.embedding_model
        ... )
        >>> len(embedding)
        768
    """
    try:
        logger.debug(f"Generating embedding for text (length: {len(text)} chars)")
        
        # Configure Gemini with API key
        genai.configure(api_key=api_key)
        
        # Generate embedding
        result = genai.embed_content(
            model=embedding_model,
            content=text,
            task_type=task_type,
            output_dimensionality=output_dimensionality
        )
        
        logger.debug(f"API Response Type: {type(result)}")
        
        # Handle different response formats
        if hasattr(result, 'embedding'):
            embedding = result.embedding
            # Handle nested .values attribute
            if hasattr(embedding, 'values'):
                embedding = embedding.values
            logger.debug("Accessed via .embedding attribute")
        elif isinstance(result, dict) and 'embedding' in result:
            embedding = result['embedding']
            logger.debug("Accessed via ['embedding'] key")
        elif isinstance(result, dict) and 'embeddings' in result:
            embedding = result['embeddings'][0]
            logger.debug("Accessed via ['embeddings'][0]")
        elif isinstance(result, list):
            embedding = result
            logger.debug("Result is already a list")
        else:
            logger.error(f"Unexpected response structure: {type(result)}")
            if isinstance(result, dict):
                logger.error(f"Available keys: {result.keys()}")
            raise ValueError(f"Unexpected embedding response structure: {type(result)}")
        
        # Normalize if requested (recommended for 768 and 1536 dimensions)
        if normalize:
            emb_array = np.array(embedding)
            norm = np.linalg.norm(emb_array)
            if norm > 0:
                embedding = (emb_array / norm).tolist()
                logger.debug(f"Normalized embedding to unit length")
            else:
                logger.warning("Embedding norm is 0, skipping normalization")
        
        logger.debug(f"Successfully generated embedding (dimension: {len(embedding)})")
        return embedding
        
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}", exc_info=True)
        raise ValueError(f"Failed to generate embedding: {str(e)}")
