from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ============================================================================
    # DATABASE CONFIGURATION
    # ============================================================================
    chatbot_database_url: str  # For chat messages and chat heads
    management_database_url: str  # For documents, chunks, sections, users, etc.

    # ============================================================================
    # EMBEDDING & LLM CONFIGURATION
    # ============================================================================
    # Google API (for embeddings only)
    google_api_key: str
    embedding_model: str = "models/gemini-embedding-001"

    # LLM Provider Configuration (for text generation)
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash"
    openai_api_key: str | None = None
    
    # Hugging Face token for faster model downloads and private models
    hugging_face_token: str | None = None

    # ============================================================================
    # HYBRID RETRIEVAL CONFIGURATION
    # ============================================================================
    
    # --- Retrieval Strategy Weights ---
    # These weights determine how dense (vector) and sparse (BM25) scores are combined
    # Must sum to 1.0. Higher dense_weight = more semantic matching, higher sparse_weight = more keyword matching
    dense_weight: float = 0.85  # Weight for vector similarity (85%)
    sparse_weight: float = 0.15  # Weight for BM25 keyword matching (15%)
    
    # --- Retrieval Pool Sizes ---
    # Controls how many chunks are fetched at each stage of the pipeline
    
    # Number of chunks to fetch from dense (vector) retrieval PER DOCUMENT
    # None = fetch ALL chunks from database (no limit)
    # Integer = fetch only top N chunks per document
    dense_top_k: int | None = None
    
    # Number of chunks to fetch from sparse (BM25) retrieval PER DOCUMENT
    # None = fetch ALL chunks from database (no limit)
    # Integer = fetch only top N chunks per document
    sparse_top_k: int | None = None
    
    # Number of top chunks to keep ACROSS ALL DOCUMENTS before reranking
    # This is the most critical limit - determines how many chunks get reranked
    # Example: With 3 docs, final_top_k=20 means top 20 chunks total (not per doc)
    final_top_k: int = 20
    
    # Maximum number of chunks to pass to LLM after threshold filtering
    # This is a soft limit - actual number depends on threshold filtering (usually 5-10)
    max_chunks_to_llm: int = 20
    
    # --- Reranker Models ---
    # Fast model: ~50ms per query, good quality
    reranker_model_fast: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    
    # Deep model: ~200ms per query, state-of-the-art quality, 8192 token context
    reranker_model_deep: str = "jinaai/jina-reranker-v3"
    
    # ============================================================================
    # THRESHOLD FILTERING CONFIGURATION
    # ============================================================================
    
    # --- Reranker-Based Thresholds (for positive scores) ---
    # These percentages are multiplied by the best rerank score to determine cutoffs
    # Lower percentage = more lenient (more chunks pass), Higher = stricter (fewer chunks pass)
    
    # Threshold for chunks in the SAME SECTION as the best chunk (most lenient)
    # Example: If best score = 0.92, threshold = 0.92 * 0.50 = 0.46
    threshold_same_section_percent: float = 0.50  # 50% of best score
    
    # Threshold for chunks in the SAME DOCUMENT as the best chunk (medium strictness)
    # Example: If best score = 0.92, threshold = 0.92 * 0.65 = 0.60
    threshold_same_doc_percent: float = 0.65  # 65% of best score
    
    # Threshold for chunks in OTHER DOCUMENTS (most strict)
    # Example: If best score = 0.92, threshold = 0.92 * 0.75 = 0.69
    threshold_other_doc_percent: float = 0.75  # 75% of best score
    
    # --- Dense Fallback Threshold ---
    # Dual-pass filtering: chunks can pass via reranker threshold OR dense fallback
    # This is the percentage of the best rerank chunk's dense score
    # Example: If best chunk has dense=0.88, threshold = 0.88 * 0.90 = 0.79
    dense_fallback_percent: float = 0.90  # 90% of best chunk's dense score
    
    # --- Reranker-Based Thresholds (for negative scores) ---
    # When rerank scores are negative, we use margin-based approach instead of multiplication
    
    # Margin for same section (most lenient)
    # Example: If best score = -0.50, margin = 0.50 * 0.50 = 0.25, threshold = -0.50 - 0.25 = -0.75
    threshold_same_section_margin_percent: float = 0.50  # 50% margin
    
    # Margin for same document (medium)
    # Example: If best score = -0.50, margin = 0.50 * 0.35 = 0.175, threshold = -0.50 - 0.175 = -0.675
    threshold_same_doc_margin_percent: float = 0.35  # 35% margin
    
    # Margin for other documents (most strict)
    # Example: If best score = -0.50, margin = 0.50 * 0.25 = 0.125, threshold = -0.50 - 0.125 = -0.625
    threshold_other_doc_margin_percent: float = 0.25  # 25% margin
    
    # --- Traditional Thresholds (for non-reranked results) ---
    # Used when reranking is disabled or as fallback
    
    # Threshold for chunks in same document (70% of best cosine similarity score)
    threshold_same_doc_traditional_percent: float = 0.70
    
    # Threshold for chunks in other documents (85% of best cosine similarity score)
    threshold_other_doc_traditional_percent: float = 0.85
    
    # ============================================================================
    # GENERAL LIMITS
    # ============================================================================
    max_active_documents: int = 5  # Maximum documents user can select at once
    
    # Maximum tokens the LLM can generate in a single response
    # None = no limit (uses model's default), Integer = hard limit on output tokens
    # Recommended: 1000-2000 for chat responses, 4000-8000 for summaries
    max_output_tokens: int | None = None  # No limit by default

    # ============================================================================
    # TOKEN QUOTA CONFIGURATION
    # ============================================================================
    # Token quota defaults (must match management service defaults)
    default_token_limit: int = 100000  # Default tokens per user per window
    default_reset_interval_hours: int = 24  # Quota reset window in hours

    # ============================================================================
    # AUTHENTICATION
    # ============================================================================
    jwt_secret: str
    jwt_algorithm: str


@lru_cache()
def get_settings() -> Settings:
    return Settings()