"""
Embeddings generation using Google Generative AI.
Handles batching, rate limiting, and retries.
"""

import logging
import time
from typing import List, Optional, Any
import google.generativeai as genai
import numpy as np

logger = logging.getLogger(__name__)


class EmbeddingConfig:
    """Configuration for embedding generation."""
    def __init__(
        self,
        model_name: str = "models/gemini-embedding-001",
        batch_size: int = 100,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        dimension: int = 768,
    ):
        self.model_name = model_name
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.dimension = dimension


class EmbeddingService:
    """Service for generating embeddings with Google AI."""
    
    def __init__(self, api_key: str, config: Optional[EmbeddingConfig] = None):
        """
        Initialize embedding service.
        
        Args:
            api_key: Google API key
            config: Optional EmbeddingConfig
        """
        if not api_key:
            raise ValueError("Google API key is required")
        
        self.config = config or EmbeddingConfig()
        genai.configure(api_key=api_key)
        logger.info(f"Initialized embedding service with model: {self.config.model_name}")
    
    def _embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a batch of texts with retry logic.
        """
        embeddings = []
        for attempt in range(self.config.max_retries):
            try:
                for text in texts:
                    result = genai.embed_content(
                        model=self.config.model_name,
                        content=text,
                        task_type="retrieval_document",
                        output_dimensionality=self.config.dimension
                    )

                    # Extract embedding safely
                    if hasattr(result, 'embedding'):
                        emb = result.embedding
                        if hasattr(emb, 'values'):
                            emb = emb.values
                        embeddings.append(emb)
                    elif isinstance(result, dict) and "embedding" in result:
                        embeddings.append(result["embedding"])
                    else:
                        raise ValueError("No embedding found in response")

                # Normalize embeddings for 768 dimensions (required for accurate similarity)
                if self.config.dimension == 768:
                    embeddings = self._normalize_embeddings(embeddings)
                
                return embeddings

            except Exception as e:
                logger.warning(f"Embedding attempt {attempt + 1} failed: {e}")
                if attempt < self.config.max_retries - 1:
                    delay = self.config.retry_delay * (2 ** attempt)
                    logger.info(f"Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    logger.error(f"All {self.config.max_retries} embedding attempts failed")
                    raise

    def _normalize_embeddings(self, embeddings: List[List[float]]) -> List[List[float]]:
        """
        Normalize embeddings to unit length for accurate cosine similarity.
        Required for 768 and 1536 dimensions according to Google's documentation.
        """
        normalized = []
        for emb in embeddings:
            emb_array = np.array(emb)
            norm = np.linalg.norm(emb_array)
            if norm > 0:
                normalized_emb = (emb_array / norm).tolist()
            else:
                normalized_emb = emb  # Keep original if norm is 0
            normalized.append(normalized_emb)
        return normalized


    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Embed a list of texts, handling batching automatically.
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            List of embedding vectors (same order as input)
        """
        if not texts:
            return []
        
        logger.info(f"Embedding {len(texts)} texts in batches of {self.config.batch_size}")
        all_embeddings = []
        
        # Process in batches
        for i in range(0, len(texts), self.config.batch_size):
            batch = texts[i:i + self.config.batch_size]
            batch_num = (i // self.config.batch_size) + 1
            total_batches = (len(texts) + self.config.batch_size - 1) // self.config.batch_size
            
            logger.info(f"Processing batch {batch_num}/{total_batches}")
            
            embeddings = self._embed_batch(batch)
            all_embeddings.extend(embeddings)
            
            # Rate limiting: small delay between batches
            if i + self.config.batch_size < len(texts):
                time.sleep(0.5)
        
        logger.info(f"Successfully embedded {len(all_embeddings)} texts")
        return all_embeddings
    
    def embed_chunks(self, chunks: List[Any]) -> List[List[float]]:
        """
        Embed a list of Chunk objects.
        
        Args:
            chunks: List of Chunk objects from chunking.py
            
        Returns:
            List of embedding vectors
        """
        texts = [chunk.text for chunk in chunks]
        return self.embed_texts(texts)


def create_embedding_service(api_key: str, config: Optional[EmbeddingConfig] = None) -> EmbeddingService:
    """
    Factory function to create embedding service.
    
    Args:
        api_key: Google API key
        config: Optional EmbeddingConfig
        
    Returns:
        EmbeddingService instance
    """
    return EmbeddingService(api_key, config)


# Convenience function for pipeline integration
def generate_embeddings(
    chunks: List[Any],
    api_key: str,
    config: Optional[EmbeddingConfig] = None
) -> List[List[float]]:
    """
    Generate embeddings for a list of chunks.
    
    Args:
        chunks: List of Chunk objects
        api_key: Google API key
        config: Optional EmbeddingConfig
        
    Returns:
        List of embedding vectors
    """
    service = create_embedding_service(api_key, config)
    return service.embed_chunks(chunks)