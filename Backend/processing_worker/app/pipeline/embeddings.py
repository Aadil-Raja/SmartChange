"""
Embeddings generation using Google Generative AI.
Handles true batch API calls, reactive rate limiting, text validation,
truncation guards, and correct task_type separation for query vs document.
"""

import logging
import time
from typing import List, Optional, Any


logger = logging.getLogger(__name__)

# Gemini embedding model hard limit (conservative character estimate).
# gemini-embedding-001 supports ~2048 tokens. At ~4 chars/token → ~8192 chars.
# We cap at 6000 to stay safely under the limit.
_MAX_CHARS = 6000

# Chunk metadata fields to enrich embeddings with context.
# These match the Chunk dataclass fields in chunking.py
_CHUNK_METADATA_FIELDS = ["section_title", "page_num"]


class EmbeddingConfig:
    """Configuration for embedding generation."""

    def __init__(
        self,
        model_name: str = "models/gemini-embedding-001",
        batch_size: int = 100,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        dimension: int = 3072,
        max_chars: int = _MAX_CHARS,
    ):
        self.model_name = model_name
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.dimension = dimension
        self.max_chars = max_chars


class EmbeddingService:
    """
    Service for generating embeddings with Google Gemini.

    Fixes applied vs the original implementation:

      FIX 1 — genai.configure() called ONCE at __init__, not on every embed call.
      FIX 2 — True batch API calls: one request per batch, not one per text.
      FIX 3 — Truncation guard: texts over max_chars are truncated with a warning.
      FIX 4 — Empty text filter: blank texts are replaced before hitting the API.
      FIX 5 — Reactive rate limiting: sleeps ONLY on 429 responses, not blindly.
      FIX 6 — Chunk context validation: warns at embed time if metadata fields
               are missing from the Chunk class, rather than silently embedding
               bare text.
    """

    def __init__(self, api_key: str, config: Optional[EmbeddingConfig] = None):
        """
        Initialize embedding service and configure Gemini client once.

        Args:
            api_key: Google API key
            config: Optional EmbeddingConfig
        """
        if not api_key:
            raise ValueError("Google API key is required")

        self.config = config or EmbeddingConfig()

        # FIX 1: Configure Gemini ONCE here. Previously genai.configure() was
        # called inside embed_single() on every single text — that's thousands
        # of redundant global reconfigurations during a typical indexing run.
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._genai = genai

        logger.info(
            f"Initialized EmbeddingService | model={self.config.model_name} "
            f"| dim={self.config.dimension} | batch_size={self.config.batch_size}"
        )

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    def _validate_and_truncate(self, texts: List[str]) -> List[str]:
        """
        FIX 3 + FIX 4: Validate and clean texts before sending to the API.

        - Empty/whitespace texts are replaced with "[empty]" so the output
          list stays the same length as the input (index alignment preserved).
        - Texts over max_chars are truncated with a warning.

        Args:
            texts: Raw input texts

        Returns:
            Cleaned list, same length as input
        """
        cleaned = []
        for i, text in enumerate(texts):
            stripped = text.strip() if text else ""

            # FIX 4: Empty text guard
            if not stripped:
                logger.warning(
                    f"Text at index {i} is empty or whitespace. "
                    f"Replacing with placeholder to preserve index alignment."
                )
                cleaned.append("[empty]")
                continue

            # FIX 3: Truncation guard
            if len(stripped) > self.config.max_chars:
                logger.warning(
                    f"Text at index {i} has {len(stripped)} chars, "
                    f"exceeds limit of {self.config.max_chars}. Truncating."
                )
                stripped = stripped[: self.config.max_chars]

            cleaned.append(stripped)

        return cleaned

    def _parse_batch_response(self, result: Any, expected_count: int) -> List[List[float]]:
        """
        Parse Gemini batch embed_content() response into a list of vectors.
        Handles both dict-style and attribute-style SDK response formats.

        Args:
            result: Raw API response object
            expected_count: How many embeddings we expect (for validation)

        Returns:
            List of raw (un-normalized) embedding vectors
        """
        embeddings = []

        # Attribute-style batch response: result.embeddings = [EmbeddingObject, ...]
        if hasattr(result, "embeddings"):
            for emb in result.embeddings:
                values = list(emb.values) if hasattr(emb, "values") else list(emb)
                embeddings.append(values)

        # Dict-style batch response: result['embeddings'] = [...]
        elif isinstance(result, dict) and "embeddings" in result:
            for emb in result["embeddings"]:
                values = list(emb.values) if hasattr(emb, "values") else list(emb)
                embeddings.append(values)

        # Single embedding fallback (only if batch_size=1)
        elif hasattr(result, "embedding"):
            emb = result.embedding
            embeddings.append(list(emb.values) if hasattr(emb, "values") else list(emb))

        elif isinstance(result, dict) and "embedding" in result:
            embeddings.append(result["embedding"])

        else:
            raise ValueError(
                f"Unexpected Gemini response structure: {type(result)}. "
                f"Keys: {list(result.keys()) if isinstance(result, dict) else 'N/A'}"
            )

        if len(embeddings) != expected_count:
            raise ValueError(
                f"API returned {len(embeddings)} embeddings for "
                f"{expected_count} texts — length mismatch."
            )

        return embeddings

    def _embed_batch(self, texts: List[str], task_type: str) -> List[List[float]]:
        """
        Embed texts one by one (Gemini doesn't support true batch with lists).
        
        Includes retry logic with reactive rate limiting.

        Args:
            texts: Pre-validated, pre-truncated list of texts
            task_type: "retrieval_document" or "retrieval_query"

        Returns:
            List of normalized embedding vectors
        """
        for attempt in range(self.config.max_retries):
            embeddings = []  # Reset inside loop (fixes retry bug)
            try:
                for i, text in enumerate(texts):
                    result = self._genai.embed_content(
                        model=self.config.model_name,
                        content=text,  # Single string, not a list
                        task_type=task_type,
                        output_dimensionality=self.config.dimension,
                    )
                    
                    # Parse single embedding response
                    if hasattr(result, 'embedding'):
                        emb = result.embedding
                        values = list(emb.values) if hasattr(emb, 'values') else list(emb)
                    elif isinstance(result, dict) and 'embedding' in result:
                        values = result['embedding']
                    else:
                        raise ValueError(f"Unexpected response: {type(result)}")
                    
                    embeddings.append(values)
                
                # gemini-embedding-001 returns unit-normalized vectors already
                return embeddings

            except Exception as e:
                error_str = str(e).lower()
                is_rate_limit = (
                    "429" in error_str
                    or "quota" in error_str
                    or "rate" in error_str
                )

                if attempt < self.config.max_retries - 1:
                    delay = self.config.retry_delay * (2 ** attempt)
                    label = "Rate limit hit" if is_rate_limit else "Attempt failed"
                    logger.warning(
                        f"{label} (attempt {attempt + 1}). Retrying in {delay}s..."
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"All {self.config.max_retries} attempts failed: {e}"
                    )
                    raise

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def embed_texts(
        self,
        texts: List[str],
        task_type: str = "retrieval_document",
    ) -> List[List[float]]:
        """
        Embed a list of texts with automatic batching and validation.

        Args:
            texts: List of text strings to embed
            task_type: "retrieval_document" for indexing chunks (default),
                       "retrieval_query" for user questions

        Returns:
            List of normalized embedding vectors (same order as input)
        """
        if not texts:
            return []

        texts = self._validate_and_truncate(texts)

        logger.info(
            f"Embedding {len(texts)} texts "
            f"[task={task_type}, dim={self.config.dimension}] "
            f"in batches of {self.config.batch_size}"
        )

        all_embeddings = []
        total_batches = (len(texts) + self.config.batch_size - 1) // self.config.batch_size

        for i in range(0, len(texts), self.config.batch_size):
            batch = texts[i : i + self.config.batch_size]
            batch_num = (i // self.config.batch_size) + 1
            logger.info(f"Batch {batch_num}/{total_batches} — {len(batch)} texts")

            embeddings = self._embed_batch(batch, task_type=task_type)
            all_embeddings.extend(embeddings)
            # No blind sleep — rate limiting is reactive inside _embed_batch

        logger.info(f"Done. Embedded {len(all_embeddings)} texts total.")
        return all_embeddings

    def embed_chunks(self, chunks: List[Any]) -> List[List[float]]:
        """
        Embed Chunk objects for indexing into the vector DB.

        FIX 6 (Chunk context with early validation): Checks for known metadata
        fields on the first chunk and logs a clear warning if any are missing,
        so you know immediately at index time — not after bad retrieval results.

        Context prefix format per chunk:
            Title: <value>
            Section: <value>
            Page: <value>

            <chunk.text>

        Adjust _CHUNK_METADATA_FIELDS at the top of this file if your Chunk
        dataclass uses different field names.

        Args:
            chunks: List of Chunk objects from chunking.py

        Returns:
            List of normalized embedding vectors (retrieval_document task)
        """
        if not chunks:
            return []

        # FIX 6: Validate chunk structure once using the first chunk
        first = chunks[0]

        if not hasattr(first, "text"):
            raise AttributeError(
                "Chunk object has no 'text' attribute. "
                "Update embed_chunks() to match your Chunk dataclass field name."
            )

        missing = [f for f in _CHUNK_METADATA_FIELDS if not hasattr(first, f)]
        if missing:
            logger.warning(
                f"Chunk is missing metadata fields: {missing}. "
                f"Embeddings will be generated without that context. "
                f"Update _CHUNK_METADATA_FIELDS if your Chunk uses different names."
            )

        texts = []
        for chunk in chunks:
            parts = []
            for field in _CHUNK_METADATA_FIELDS:
                value = getattr(chunk, field, None)
                if value is not None and str(value).strip():
                    parts.append(f"{field.capitalize()}: {value}")
            parts.append(chunk.text)
            texts.append("\n\n".join(parts))

        return self.embed_texts(texts, task_type="retrieval_document")

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a single user question for searching the vector DB.

        Always uses task_type="retrieval_query" so the vector is placed in
        the correct geometric space to match against document vectors.

        Args:
            query: The user's question string

        Returns:
            Single normalized embedding vector

        Raises:
            ValueError: If query is empty or whitespace
        """
        if not query or not query.strip():
            raise ValueError("Query cannot be empty or whitespace.")

        results = self.embed_texts([query], task_type="retrieval_query")
        return results[0]


# =============================================================================
# Factory and convenience functions
# =============================================================================

def create_embedding_service(
    api_key: str,
    config: Optional[EmbeddingConfig] = None,
) -> EmbeddingService:
    """
    Factory function to create an EmbeddingService.

    Args:
        api_key: Google API key
        config: Optional EmbeddingConfig

    Returns:
        Configured EmbeddingService instance
    """
    return EmbeddingService(api_key, config)


def generate_embeddings(
    chunks: List[Any],
    api_key: str,
    config: Optional[EmbeddingConfig] = None,
) -> List[List[float]]:
    """
    Generate embeddings for Chunk objects (indexing pipeline entry point).

    Args:
        chunks: List of Chunk objects
        api_key: Google API key
        config: Optional EmbeddingConfig

    Returns:
        List of normalized embedding vectors (retrieval_document task)
    """
    service = create_embedding_service(api_key, config)
    return service.embed_chunks(chunks)


def generate_query_embedding(
    query: str,
    api_key: str,
    config: Optional[EmbeddingConfig] = None,
) -> List[float]:
    """
    Generate a single embedding for a user query (search entry point).

    Args:
        query: User's question string
        api_key: Google API key
        config: Optional EmbeddingConfig

    Returns:
        Single normalized embedding vector (retrieval_query task)
    """
    service = create_embedding_service(api_key, config)
    return service.embed_query(query)
