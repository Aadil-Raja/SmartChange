# app/services/tools/hybrid_retrieval.py
"""
Hybrid retrieval combining Dense (vector) + Sparse (BM25) search with reranking.

This module provides:
1. Dense retrieval: Cosine similarity with embeddings (existing)
2. Sparse retrieval: BM25 keyword matching (new)
3. Reranking: Cross-encoder to score and rerank results (new)

Usage:
    from app.services.tools.hybrid_retrieval import hybrid_retrieve_chunks
    
    chunks = hybrid_retrieve_chunks(
        chunk_db=db,
        document_ids=[39, 41, 45],
        question="What is the insulation resistance on page 191?",
        top_k=5
    )
"""
import sys
import os
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from rank_bm25 import BM25Okapi
import numpy as np

# Import debug logger
from app.utils.debug_logger import debug_log

# Load environment variables (for HF_TOKEN)
from dotenv import load_dotenv
load_dotenv()

# Set HuggingFace token if available
if os.getenv('HF_TOKEN'):
    os.environ['HUGGING_FACE_HUB_TOKEN'] = os.getenv('HF_TOKEN')



# ============================================================================
# GLOBAL STAGE DATA (for buffered logging)
# ============================================================================
# These are set during hybrid retrieval and accessed by retriever for logging
_stage1_data = None  # All chunks with dense+sparse scores
_stage2_data = None  # Top 20 passed to reranker
_stage3_data = None  # Reranked chunks


# ============================================================================
# CONFIGURATION - All values now loaded from config.py
# ============================================================================
from app.core.config import get_settings

# Global model cache (loaded once per model, reused for all requests)
_reranker_models = {}
import threading
_reranker_lock = threading.Lock()  # Prevents concurrent access to non-thread-safe tokenizers (e.g. jina-v3)


def _get_reranker_model(model_name: str):
    """
    Get or load the reranker model (cached globally per model).
    
    Handles two different model types:
    - Fast (CrossEncoder): ms-marco-MiniLM-L-6-v2
    - Deep (Jina custom): jina-reranker-v3
    """
    global _reranker_models
    settings = get_settings()
    
    if model_name not in _reranker_models:
        import os
        
        # Set HuggingFace token if available
        hf_token = os.environ.get('HF_TOKEN')
        if hf_token:
            os.environ['HUGGING_FACE_HUB_TOKEN'] = hf_token
        
        # Never re-download if already cached — fail fast if missing in production
        import os as _os
        if _os.environ.get("TRANSFORMERS_OFFLINE", "0") != "1":
            # Use config setting or auto-detect from cache
            if settings.transformers_offline:
                _os.environ["TRANSFORMERS_OFFLINE"] = "1"
                _os.environ["HF_DATASETS_OFFLINE"] = "1"
                debug_log("Offline mode enabled via config", "HYBRID")
            else:
                # Auto-detect: if model already cached locally, enable offline mode
                import pathlib
                hf_home = _os.environ.get("HF_HOME", str(pathlib.Path.home() / ".cache" / "huggingface"))
                model_cache_name = "models--" + model_name.replace("/", "--")
                model_cache_path = pathlib.Path(hf_home) / "hub" / model_cache_name
                if model_cache_path.exists():
                    _os.environ["TRANSFORMERS_OFFLINE"] = "1"
                    _os.environ["HF_DATASETS_OFFLINE"] = "1"
                    debug_log(f"Model cache found at {model_cache_path}, enabling offline mode", "HYBRID")

        debug_log(f"Loading reranker model: {model_name} (first time only)", "HYBRID")
        
        # Use different loading methods for different models
        if model_name == settings.reranker_model_deep:
            # Jina v3 uses custom architecture - load with AutoModel + trust_remote_code
            from transformers import AutoModel
            model = AutoModel.from_pretrained(
                model_name,
                torch_dtype="auto",
                trust_remote_code=True,  # Loads Jina's custom JinaForRanking class
                token=settings.hugging_face_token,  # ✅ Use HF token for faster downloads
            )
            model.eval()
            _reranker_models[model_name] = {'model': model, 'type': 'jina'}
        else:
            # Fast model uses standard CrossEncoder
            from sentence_transformers import CrossEncoder
            model = CrossEncoder(model_name)
            _reranker_models[model_name] = {'model': model, 'type': 'cross_encoder'}
        
        debug_log(f"Reranker model {model_name} loaded and cached", "HYBRID")
    
    return _reranker_models[model_name]


# ============================================================================
# CONFIGURATION
# ============================================================================
# Threshold for switching between NumPy and HNSW
# Below this: Use NumPy (faster for small filtered datasets)
# Above this: Use HNSW (scales better for large datasets)
NUMPY_THRESHOLD = 5000  # chunks

# ============================================================================
# NUMPY-BASED RETRIEVAL (Optimized for Small Filtered Datasets)
# ============================================================================

def fetch_and_score_with_numpy(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    top_k_total: int = 100
) -> Dict[int, Dict]:
    """
    Fetch chunks from active documents and score with NumPy.
    
    OPTIMIZED FOR: Small datasets with document filtering
    
    Why NumPy is faster for your use case:
    1. Filter-first: Fetches only chunks from active documents
    2. No pre-filtering problem: HNSW searches all, then filters (slow)
    3. In-memory scoring: NumPy cosine similarity is instant for small data
    4. Single simple query: No complex HNSW query overhead
    
    Performance:
    - 36-259 chunks: ~0.15s (vs 2.2s with HNSW)
    - 1000 chunks: ~0.3s
    - 5000 chunks: ~1s (at this point, HNSW becomes better)
    
    Args:
        chunk_db: Database session
        document_ids: List of document IDs to search
        question: User's question
        top_k_total: Number of top chunks to return
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks, query_embedding}]
    """
    from shared.models.Document import DocumentChunk
    from shared.repos import documents_repo
    from shared.llm import embed_single
    import numpy as np
    import time
    
    debug_log(f"Using NumPy retrieval for {len(document_ids)} docs", "HYBRID")
    
    # Get document metadata
    docs = {d.id: d for d in documents_repo.get_by_ids(chunk_db, document_ids)}
    
    settings = get_settings()
    print(f"[NUMPY] Starting embedding + fetch in parallel...", file=sys.stderr)

    # ── PARALLEL: embedding API call and DB fetch run at the same time ──────
    from concurrent.futures import ThreadPoolExecutor, as_completed

    q_emb = None
    chunks = None
    embed_time = None
    fetch_time = None

    def _embed():
        t = time.time()
        try:
            result = embed_single(
                text=question,
                api_key=settings.google_api_key,
                embedding_model=settings.embedding_model,
                task_type="retrieval_query",
                output_dimensionality=3072
            )
        except Exception as emb_err:
            err_str = str(emb_err)
            if "429" in err_str or "Resource exhausted" in err_str or "ResourceExhausted" in err_str:
                raise RuntimeError("EMBEDDING_RATE_LIMIT") from emb_err
            raise
        return result, time.time() - t

    def _fetch():
        t = time.time()
        result = chunk_db.query(DocumentChunk).filter(
            DocumentChunk.document_id.in_(document_ids)
        ).all()
        return result, time.time() - t

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_embed = executor.submit(_embed)
        future_fetch = executor.submit(_fetch)
        q_emb, embed_time = future_embed.result()
        chunks, fetch_time = future_fetch.result()
    parallel_time = time.time() - t0

    print(f"[NUMPY] ⏱️  Embedding: {embed_time:.2f}s", file=sys.stderr)
    print(f"[NUMPY] ⏱️  Fetch query: {fetch_time:.2f}s ({len(chunks)} chunks)", file=sys.stderr)
    print(f"[NUMPY] ⏱️  Parallel wall time: {parallel_time:.2f}s (saved ~{embed_time + fetch_time - parallel_time:.2f}s)", file=sys.stderr)
    debug_log(f"Parallel embed+fetch took {parallel_time:.2f}s (embed={embed_time:.2f}s, fetch={fetch_time:.2f}s)", "HYBRID")
    # ────────────────────────────────────────────────────────────────────────

    try:
        
        if not chunks:
            debug_log(f"No chunks found for documents {document_ids}", "HYBRID")
            return {}
        
        # Step 3: Compute cosine similarities with NumPy (instant!)
        t2 = time.time()
        
        # Normalize query embedding
        q_array = np.array(q_emb, dtype=np.float32)
        q_norm = q_array / np.linalg.norm(q_array)
        
        # Normalize chunk embeddings
        embeddings = np.array([chunk.embedding for chunk in chunks], dtype=np.float32)
        embeddings_norm = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
        
        # Compute cosine similarities (dot product of normalized vectors)
        similarities = embeddings_norm @ q_norm
        
        score_time = time.time() - t2
        print(f"[NUMPY] ⏱️  Similarity scoring: {score_time:.3f}s", file=sys.stderr)
        debug_log(f"Computed {len(similarities)} similarities in {score_time:.3f}s", "HYBRID")
        
        # Step 4: Get top-K indices
        top_k = min(top_k_total, len(chunks))
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        # Step 5: Group by document
        chunks_by_doc = {}
        for idx in top_indices:
            chunk = chunks[idx]
            similarity = float(similarities[idx])
            doc_id = chunk.document_id
            
            if doc_id not in chunks_by_doc:
                doc = docs.get(doc_id)
                if not doc:
                    continue
                
                chunks_by_doc[doc_id] = {
                    "doc_title": doc.title,
                    "doc_description": doc.description or "",
                    "cloudinary_url": doc.cloudinary_url,
                    "chunks": [],
                    "query_embedding": q_emb
                }
            
            chunks_by_doc[doc_id]["chunks"].append({
                'chunk_index': chunk.chunk_index,
                'text': chunk.text,
                'dense_score': similarity,  # Cosine similarity (0-1)
                'start_page_num': chunk.start_page_num,
                'end_page_num': chunk.end_page_num,
                'section_title': chunk.section_title,
                'document_id': chunk.document_id,
            })
        
        # Log distribution
        for doc_id, data in chunks_by_doc.items():
            debug_log(f"Doc {doc_id}: {len(data['chunks'])} chunks in top-{top_k}", "HYBRID")
        
        total_time = time.time() - t0
        print(f"[NUMPY] ✅ Total time: {total_time:.2f}s", file=sys.stderr)
        
        return chunks_by_doc
        
    except Exception as e:
        debug_log(f"NumPy retrieval error: {e}", "HYBRID")
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {}


# ============================================================================
# HNSW-BASED RETRIEVAL (Optimized for Large Datasets)
# ============================================================================

def fetch_top_chunks_across_all_docs(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    top_k_total: int = 100
) -> Dict[int, Dict]:
    """
    Fetch top-K chunks using HNSW index (for large datasets).
    
    OPTIMIZED FOR: Large datasets (5000+ chunks)
    
    Note: HNSW has a "pre-filtering problem" - it searches all chunks first,
    then filters by document_id. For small filtered datasets, NumPy is faster.
    
    Args:
        top_k_total: Total number of chunks to fetch
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks, query_embedding}]
    """
    from shared.models.Document import DocumentChunk
    from shared.repos import documents_repo
    from shared.llm import embed_single
    import sqlalchemy as sa
    from pgvector.sqlalchemy import HALFVEC
    
    debug_log(f"Fetching top-{top_k_total} chunks ACROSS ALL {len(document_ids)} docs (single query with HNSW)...", "HYBRID")
    
    # Get document metadata
    docs = {d.id: d for d in documents_repo.get_by_ids(chunk_db, document_ids)}
    
    # Generate query embedding once
    settings = get_settings()
    print(f"[FETCH] Starting embedding generation...", file=sys.stderr)
    
    import time
    t0 = time.time()
    q_emb = embed_single(
        text=question,
        api_key=settings.google_api_key,
        embedding_model=settings.embedding_model,
        task_type="retrieval_query",
        output_dimensionality=3072
    )
    embed_time = time.time() - t0
    print(f"[FETCH] ⏱️  Embedding: {embed_time:.2f}s", file=sys.stderr)
    debug_log(f"Embedding generation took {embed_time:.2f}s", "HYBRID")
    
    try:
        # ✅ First, count total chunks in active documents
        import time
        t_count = time.time()
        
        total_chunks = chunk_db.query(DocumentChunk).filter(
            DocumentChunk.document_id.in_(document_ids)
        ).count()
        
        count_time = time.time() - t_count
        print(f"[FETCH] ⏱️  Count query: {count_time:.2f}s ({total_chunks} chunks)", file=sys.stderr)
        debug_log(f"Total chunks in active documents: {total_chunks}", "HYBRID")
        
        if total_chunks == 0:
            debug_log(f"No chunks found in documents {document_ids}", "HYBRID")
            return {}
        
        # Use the smaller of: requested top_k or total available chunks
        actual_limit = min(top_k_total, total_chunks)
        
        # ✅ Set higher ef_search for filtered queries
        ef_search = max(200, actual_limit * 2)
        chunk_db.execute(sa.text(f"SET LOCAL hnsw.ef_search = {ef_search}"))
        print(f"[FETCH] Set ef_search={ef_search} for {len(document_ids)} docs with {total_chunks} chunks", file=sys.stderr)
        
        t1 = time.time()
        
        # ✅ Convert embedding to PostgreSQL array format
        emb_str = '[' + ','.join(map(str, q_emb)) + ']'
        
        print(f"[FETCH] Executing filtered HNSW query for {actual_limit} chunks...", file=sys.stderr)
        
        # Use raw SQL with direct string substitution for embedding
        # Use parameterized query for doc_ids and limit
        rows = chunk_db.execute(sa.text(f"""
            SELECT 
                c.*,
                (c.embedding::halfvec(3072)) <=> '{emb_str}'::halfvec(3072) AS distance
            FROM document_chunks c
            WHERE c.document_id = ANY(:doc_ids)
            ORDER BY distance
            LIMIT :limit_val
        """), {
            'doc_ids': document_ids,
            'limit_val': actual_limit
        }).fetchall()
        
        query_time = time.time() - t1
        print(f"[FETCH] ⏱️  Main query: {query_time:.2f}s ({len(rows)} rows)", file=sys.stderr)
        debug_log(f"Filtered HNSW query took {query_time:.2f}s", "HYBRID")
        
        if not rows:
            debug_log(f"No chunks found for documents {document_ids}", "HYBRID")
            return {}
        
        debug_log(f"Retrieved {len(rows)} chunks from database", "HYBRID")
        
        # Convert raw SQL results to chunk objects
        chunks_by_doc = {}
        for row in rows:
            doc_id = row.document_id
            
            if doc_id not in chunks_by_doc:
                doc = docs.get(doc_id)
                if not doc:
                    continue
                
                chunks_by_doc[doc_id] = {
                    "doc_title": doc.title,
                    "doc_description": doc.description or "",
                    "cloudinary_url": doc.cloudinary_url,
                    "chunks": [],
                    "query_embedding": q_emb
                }
            
            chunks_by_doc[doc_id]["chunks"].append({
                'chunk_index': row.chunk_index,
                'text': row.text,
                'dense_score': float(1.0 - row.distance),  # Convert distance to similarity
                'start_page_num': row.start_page_num,
                'end_page_num': row.end_page_num,
                'section_title': row.section_title,
                'document_id': row.document_id,
            })
        
        # Log distribution
        for doc_id, data in chunks_by_doc.items():
            debug_log(f"Doc {doc_id}: {len(data['chunks'])} chunks in top-{top_k_total}", "HYBRID")
        
        return chunks_by_doc
        
    except Exception as e:
        debug_log(f"Error fetching chunks: {e}", "HYBRID")
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {}


# ============================================================================
# DENSE SCORING (Reuse Fetched Chunks)
# ============================================================================

def score_dense(
    fetched_chunks: Dict[int, Dict]
) -> Dict[int, Dict]:
    """
    Dense scores are already computed during fetch (using HNSW index).
    This function just returns the data in the expected format.
    
    Args:
        fetched_chunks: Output from fetch_all_chunks_once()
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    debug_log(f"Dense scoring: using pre-computed scores from HNSW index", "HYBRID")
    
    # Chunks already have dense_score from the fetch
    # Just return in the expected format
    results = {}
    for doc_id, data in fetched_chunks.items():
        results[doc_id] = {
            "doc_title": data["doc_title"],
            "cloudinary_url": data["cloudinary_url"],
            "chunks": data["chunks"]  # Already have dense_score
        }
    
    total_chunks = sum(len(v["chunks"]) for v in results.values())
    debug_log(f"Dense scoring: {total_chunks} chunks with scores", "HYBRID")
    
    return results


# ============================================================================
# SPARSE SCORING (Reuse Fetched Chunks)
# ============================================================================

def score_sparse(
    fetched_chunks: Dict[int, Dict],
    keywords: List[str] = None
) -> Dict[int, Dict]:
    """
    Sparse scoring using BM25 on already-fetched chunks.
    
    BM25 is excellent for:
    - Exact keyword matches (e.g., "page 191", "174 MΩ")
    - Acronyms (e.g., "RCC-FSD")
    - Specific terms that embeddings might miss
    
    Args:
        fetched_chunks: Output from fetch_all_chunks_once()
        keywords: Optional list of important keywords (with proper casing) from decomposer
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    debug_log(f"Sparse scoring: computing BM25 scores on fetched chunks", "HYBRID")
    
    # Determine query tokens
    if keywords and isinstance(keywords, list) and len(keywords) > 0:
        query_tokens = [kw.lower() for kw in keywords]
        debug_log(f"BM25 using {len(query_tokens)} keywords: {keywords}", "HYBRID")
    else:
        debug_log(f"No keywords provided, BM25 will use empty query (all scores = 0)", "HYBRID")
        query_tokens = []
    
    results = {}
    
    for doc_id, data in fetched_chunks.items():
        chunks = data["chunks"]
        
        if not chunks:
            continue
        
        try:
            # Tokenize corpus (simple whitespace tokenization)
            corpus = [chunk['text'].lower().split() for chunk in chunks]
            
            # Build BM25 index
            bm25 = BM25Okapi(corpus)
            
            # Get BM25 scores
            if query_tokens:
                scores = bm25.get_scores(query_tokens)
            else:
                # No keywords - assign zero scores
                scores = [0.0] * len(chunks)
            
            # Add sparse scores to chunks (keep existing dense_score)
            scored_chunks = []
            for chunk, score in zip(chunks, scores):
                chunk_copy = chunk.copy()
                chunk_copy['sparse_score'] = float(score)
                chunk_copy['score'] = chunk['dense_score']  # Keep dense as primary score for now
                scored_chunks.append(chunk_copy)
            
            results[doc_id] = {
                "doc_title": data["doc_title"],
                "cloudinary_url": data["cloudinary_url"],
                "chunks": scored_chunks
            }
            
            max_score = max(scores) if len(scores) > 0 else 0
            debug_log(f"BM25 for doc {doc_id}: {len(scored_chunks)} chunks, max score={max_score:.2f}", "HYBRID")
            
        except Exception as e:
            debug_log(f"BM25 error for doc {doc_id}: {e}", "HYBRID")
            import traceback
            traceback.print_exc(file=sys.stderr)
            continue
    
    total_chunks = sum(len(v["chunks"]) for v in results.values())
    debug_log(f"Sparse scoring: {total_chunks} chunks with BM25 scores", "HYBRID")
    
    return results


# ============================================================================
# MERGE DENSE + SPARSE RESULTS
# ============================================================================

def merge_dense_sparse_scores(
    scored_chunks: Dict[int, Dict]
) -> Dict[int, Dict]:
    """
    Merge dense and sparse scores with weighted scoring.
    
    Since chunks already have both dense_score and sparse_score,
    we just need to compute the combined score.
    
    Strategy:
    1. Normalize scores from both methods to [0, 1]
    2. Combine with weighted average
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    settings = get_settings()
    dense_weight = settings.dense_weight
    sparse_weight = settings.sparse_weight
    
    debug_log(f"Merging scores (dense_weight={dense_weight}, sparse_weight={sparse_weight})", "HYBRID")
    
    merged = {}
    
    for doc_id, data in scored_chunks.items():
        chunks = data["chunks"]
        
        if not chunks:
            continue
        
        # Normalize dense scores to [0, 1]
        max_dense = max(c.get("dense_score", 0) for c in chunks)
        
        # Normalize sparse scores to [0, 1]
        max_sparse = max(c.get("sparse_score", 0) for c in chunks)
        
        # Compute combined scores
        combined_chunks = []
        for chunk in chunks:
            dense_norm = chunk.get("dense_score", 0) / max_dense if max_dense > 0 else 0
            sparse_norm = chunk.get("sparse_score", 0) / max_sparse if max_sparse > 0 else 0
            
            combined_score = (dense_norm * dense_weight) + (sparse_norm * sparse_weight)
            
            chunk_copy = chunk.copy()
            chunk_copy["combined_score"] = combined_score
            combined_chunks.append(chunk_copy)
        
        # Sort by combined score
        combined_chunks.sort(key=lambda c: c["combined_score"], reverse=True)
        
        merged[doc_id] = {
            "doc_title": data["doc_title"],
            "cloudinary_url": data["cloudinary_url"],
            "chunks": combined_chunks
        }
        
        debug_log(f"Doc {doc_id}: {len(combined_chunks)} chunks with combined scores", "HYBRID")
    
    return merged


def pre_filter_top_k(
    merged_results: Dict[int, Dict]
) -> Dict[int, Dict]:
    """
    Pre-filter merged results to top-K chunks ACROSS ALL DOCUMENTS BEFORE reranking.
    
    This ensures:
    1. We only rerank the most promising chunks (more efficient)
    2. All reranked chunks are guaranteed to be in the pool for threshold filtering
    3. Dual-pass filtering can rescue high-dense-score chunks
    
    Args:
        merged_results: Merged dense+sparse results with combined_score
        
    Returns:
        Filtered results with top-K chunks distributed across documents
    """
    settings = get_settings()
    top_k = settings.final_top_k
    
    debug_log(f"Pre-filtering to top {top_k} chunks ACROSS ALL DOCUMENTS (based on combined score)", "HYBRID")
    
    # Collect all chunks from all documents with their metadata
    all_chunks = []
    for doc_id, data in merged_results.items():
        for chunk in data["chunks"]:
            all_chunks.append({
                "doc_id": doc_id,
                "doc_title": data["doc_title"],
                "cloudinary_url": data["cloudinary_url"],
                "chunk": chunk
            })
    
    # Sort by combined score and take top-K
    all_chunks.sort(key=lambda x: x["chunk"]["combined_score"], reverse=True)
    top_chunks = all_chunks[:top_k]
    
    debug_log(f"Selected top {len(top_chunks)} chunks from {len(all_chunks)} total chunks", "HYBRID")
    
    # Store Stage 2 data globally for retriever to access
    top20_for_stage2 = []
    for item in top_chunks:
        top20_for_stage2.append({
            'doc_id': item["doc_id"],
            'chunk_index': item["chunk"].get('chunk_index'),
            'dense_score': item["chunk"].get('dense_score', 0),
            'sparse_score': item["chunk"].get('sparse_score', 0),
            'combined_score': item["chunk"].get('combined_score', 0),
            'start_page_num': item["chunk"].get('start_page_num'),
            'section_title': item["chunk"].get('section_title')
        })
    
    global _stage2_data
    _stage2_data = top20_for_stage2
    
    # Also log to stderr with clearer formatting
    # Create set of passed chunk IDs for quick lookup
    passed_chunk_ids = {(item["doc_id"], item["chunk"].get('chunk_index')) for item in top_chunks}
    
    debug_log(f"\n{'='*80}", "HYBRID")
    debug_log(f"ALL CHUNKS SORTED BY COMBINED SCORE", "HYBRID")
    debug_log(f"✓ = Passed to reranker ({len(top_chunks)} chunks)", "HYBRID")
    debug_log(f"✗ = Filtered out ({len(all_chunks) - len(top_chunks)} chunks)", "HYBRID")
    debug_log(f"{'='*80}", "HYBRID")
    debug_log(f"{'Status':<8} {'Rank':<6} {'Doc':<6} {'Chunk':<8} {'Dense':<10} {'Sparse':<10} {'Combined':<10} {'Page':<6}", "HYBRID")
    debug_log(f"{'-'*80}", "HYBRID")
    
    for rank, item in enumerate(all_chunks, 1):
        doc_id = item["doc_id"]
        chunk = item["chunk"]
        chunk_idx = chunk.get('chunk_index', '?')
        dense_score = chunk.get('dense_score', 0)
        sparse_score = chunk.get('sparse_score', 0)
        combined_score = chunk.get('combined_score', 0)
        page = chunk.get('start_page_num', '?')
        
        # Check if this chunk passed
        passed = (doc_id, chunk_idx) in passed_chunk_ids
        status = "✓ PASS" if passed else "✗ DROP"
        
        debug_log(f"{status:<8} {rank:<6} {doc_id:<6} #{chunk_idx:<7} {dense_score:<10.4f} {sparse_score:<10.4f} {combined_score:<10.4f} {page:<6}", "HYBRID")
    
    debug_log(f"{'='*80}", "HYBRID")
    debug_log(f"Summary: {len(top_chunks)} passed, {len(all_chunks) - len(top_chunks)} dropped", "HYBRID")
    debug_log(f"{'='*80}\n", "HYBRID")
    
    # Group back by document
    filtered = {}
    for item in top_chunks:
        doc_id = item["doc_id"]
        if doc_id not in filtered:
            filtered[doc_id] = {
                "doc_title": item["doc_title"],
                "cloudinary_url": item["cloudinary_url"],
                "chunks": []
            }
        filtered[doc_id]["chunks"].append(item["chunk"])
    
    # Log distribution
    for doc_id, data in filtered.items():
        debug_log(f"Doc {doc_id}: {len(data['chunks'])} chunks in top-{top_k}", "HYBRID")
    
    return filtered


# ============================================================================
# RERANKING WITH CROSS-ENCODER
# ============================================================================

def rerank_chunks(
    merged_results: Dict[int, Dict],
    question: str,
    model_name: str
) -> Dict[int, Dict]:
    """
    Rerank merged results using a cross-encoder model.
    
    Cross-encoders are more accurate than bi-encoders (embeddings) because they
    process query + document together, but they're slower. That's why we use them
    only for reranking a small pool of candidates.
    
    NOTE: This function receives pre-filtered results (top-K across all docs),
    so it reranks ALL chunks without further filtering.
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}] with reranked chunks
    """
    try:
        debug_log(f"Reranking with {model_name}", "HYBRID")
        
        # Load reranker model (cached globally, loaded only once)
        reranker_data = _get_reranker_model(model_name)
        reranker = reranker_data['model']
        model_type = reranker_data['type']
        
        # Collect all chunks across all documents for batch reranking
        all_chunks_with_metadata = []
        for doc_id, data in merged_results.items():
            for chunk in data["chunks"]:
                all_chunks_with_metadata.append({
                    "doc_id": doc_id,
                    "doc_title": data["doc_title"],
                    "cloudinary_url": data["cloudinary_url"],
                    "chunk": chunk
                })
        
        if not all_chunks_with_metadata:
            return {}
        
        debug_log(f"Reranking {len(all_chunks_with_metadata)} chunks across all documents", "HYBRID")
        
        # Get reranking scores based on model type
        if model_type == 'jina':
            # Jina v3 uses .rerank() method with query + list of documents
            # Lock required: jina's Rust tokenizer is not thread-safe for concurrent calls
            texts = [item["chunk"]["text"] for item in all_chunks_with_metadata]
            with _reranker_lock:
                results = reranker.rerank(question, texts)
            # Results is a list of dicts with 'relevance_score' and 'index'
            rerank_scores = [r['relevance_score'] for r in results]
        else:
            # CrossEncoder uses .predict() with query-document pairs
            pairs = [[question, item["chunk"]["text"]] for item in all_chunks_with_metadata]
            rerank_scores = reranker.predict(pairs)
        
        # Add rerank scores to chunks
        for item, score in zip(all_chunks_with_metadata, rerank_scores):
            item["chunk"]["rerank_score"] = float(score)
        
        # Sort by rerank score
        all_chunks_with_metadata.sort(key=lambda x: x["chunk"]["rerank_score"], reverse=True)
        
        # Group back by document
        reranked = {}
        for item in all_chunks_with_metadata:
            doc_id = item["doc_id"]
            if doc_id not in reranked:
                reranked[doc_id] = {
                    "doc_title": item["doc_title"],
                    "cloudinary_url": item["cloudinary_url"],
                    "chunks": []
                }
            
            # Update final score to be rerank score
            chunk = item["chunk"]
            chunk["score"] = chunk["rerank_score"]
            reranked[doc_id]["chunks"].append(chunk)
        
        # Log results
        best_score = all_chunks_with_metadata[0]["chunk"]["rerank_score"] if all_chunks_with_metadata else 0
        debug_log(f"Reranked {len(all_chunks_with_metadata)} chunks, best score={best_score:.4f}", "HYBRID")
        
        # Store Stage 3 data globally for retriever to access
        reranked_for_stage3 = []
        for item in all_chunks_with_metadata:
            reranked_for_stage3.append({
                'doc_id': item["doc_id"],
                'chunk_index': item["chunk"].get('chunk_index'),
                'rerank_score': item["chunk"].get('rerank_score', 0),
                'dense_score': item["chunk"].get('dense_score', 0),
                'sparse_score': item["chunk"].get('sparse_score', 0),
                'start_page_num': item["chunk"].get('start_page_num'),
                'section_title': item["chunk"].get('section_title')
            })
        
        global _stage3_data
        _stage3_data = reranked_for_stage3
        
        # ✅ Print detailed chunk information
        debug_log(f"Top {min(5, len(all_chunks_with_metadata))} chunks after reranking:", "HYBRID")
        for i, item in enumerate(all_chunks_with_metadata[:5], 1):
            chunk = item["chunk"]
            debug_log(f"  {i}. Doc {item['doc_id']} - Chunk #{chunk.get('chunk_index', '?')}", "HYBRID")
            debug_log(f"     Rerank: {chunk['rerank_score']:.4f} | Dense: {chunk.get('dense_score', 0):.4f} | Sparse: {chunk.get('sparse_score', 0):.4f}", "HYBRID")
            debug_log(f"     Page: {chunk.get('start_page_num', '?')} | Section: {chunk.get('section_title', 'Unknown')[:50]}", "HYBRID")
            debug_log(f"     Preview: {chunk['text'][:100].replace(chr(10), ' ')}...", "HYBRID")
        
        return reranked
        
    except Exception as e:
        debug_log(f"Reranking failed: {e}, returning merged results", "HYBRID")
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        # Fallback: return merged results without reranking
        return merged_results


# ============================================================================
# MAIN HYBRID RETRIEVAL FUNCTION
# ============================================================================

def hybrid_retrieve_chunks(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    use_reranking: bool = True,
    reranker_model: str = None,
    keywords: List[str] = None  # NEW: Optional keywords from decomposer
) -> Dict[int, Dict]:
    """
    Hybrid retrieval combining dense + sparse + reranking.
    
    OPTIMIZED Pipeline:
    1. Fetch top-100 chunks across ALL docs (single DB query with HNSW index)
    2. Score dense (already computed during fetch)
    3. Score sparse (BM25 on fetched chunks) - ONLY if keywords provided
    4. Merge with weighted scores (or skip if no sparse)
    5. Pre-filter to top-K across all docs
    6. Rerank with cross-encoder → final ranked chunks
    
    Args:
        chunk_db: Database session
        document_ids: List of document IDs to search
        question: User's question
        use_reranking: Whether to use cross-encoder reranking (slower but better)
        reranker_model: Which reranker model to use (if None, uses fast model)
        keywords: Optional keywords for BM25 matching (from decomposer)
                  If None or empty, skips sparse scoring (dense only)
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
        Each chunk has: chunk_index, text, score, start_page_num, end_page_num, section_title
    """
    settings = get_settings()
    
    # Use provided model or default to fast model
    if reranker_model is None:
        reranker_model = settings.reranker_model_fast
    
    # Check if we should use sparse scoring
    use_sparse = keywords and isinstance(keywords, list) and len(keywords) > 0
    
    debug_log(f"\n[HYBRID] Starting OPTIMIZED hybrid retrieval for {len(document_ids)} docs", "HYBRID")
    debug_log(f"Question: {question[:100]}...", "HYBRID")
    debug_log(f"Keywords: {keywords if use_sparse else 'None (dense-only mode)'}", "HYBRID")
    debug_log(f"Mode: {'Dense + Sparse' if use_sparse else 'Dense only'}", "HYBRID")
    
    # ✅ AUTOMATIC SWITCHING: Choose NumPy or HNSW based on total chunk count
    # Check total chunks in database to decide which method to use
    from shared.models.Document import DocumentChunk
    total_chunks_in_db = chunk_db.query(DocumentChunk).count()
    
    use_numpy = total_chunks_in_db < NUMPY_THRESHOLD
    method = "NumPy (filter-first)" if use_numpy else "HNSW (index-based)"
    
    print(f"[HYBRID] Total chunks in DB: {total_chunks_in_db}", file=sys.stderr)
    print(f"[HYBRID] Using {method} (threshold: {NUMPY_THRESHOLD})", file=sys.stderr)
    debug_log(f"Retrieval method: {method} ({total_chunks_in_db} total chunks)", "HYBRID")
    
    # ✅ OPTIMIZATION: Choose retrieval method based on data size
    if use_numpy:
        # Small dataset: Use NumPy (filter-first, instant scoring)
        debug_log(f"Step 1: Fetching and scoring with NumPy...", "HYBRID")
        fetched_chunks = fetch_and_score_with_numpy(chunk_db, document_ids, question, top_k_total=100)
    else:
        # Large dataset: Use HNSW (scales better for large data)
        debug_log(f"Step 1: Fetching with HNSW index...", "HYBRID")
        fetched_chunks = fetch_top_chunks_across_all_docs(chunk_db, document_ids, question, top_k_total=100)
    
    if not fetched_chunks:
        debug_log(f"No chunks fetched, returning empty results", "HYBRID")
        return {}
    
    # ✅ OPTIMIZATION: Score dense (already computed during fetch)
    debug_log(f"Step 2: Dense scoring (using pre-computed HNSW scores)...", "HYBRID")
    dense_results = score_dense(fetched_chunks)
    
    # ✅ CONDITIONAL: Only score sparse if keywords provided
    if use_sparse:
        debug_log(f"Step 3: Sparse scoring (BM25 on fetched chunks with keywords)...", "HYBRID")
        sparse_results = score_sparse(fetched_chunks, keywords)
        
        # Step 4: Merge scores
        debug_log(f"Step 4: Merging dense + sparse scores...", "HYBRID")
        merged_results = merge_dense_sparse_scores(sparse_results)  # sparse_results has both scores
    else:
        debug_log(f"Step 3: Skipping sparse scoring (no keywords provided - dense only)", "HYBRID")
        # Use dense results directly, add combined_score = dense_score
        merged_results = {}
        for doc_id, data in dense_results.items():
            chunks_with_combined = []
            for chunk in data["chunks"]:
                chunk_copy = chunk.copy()
                chunk_copy["combined_score"] = chunk["dense_score"]  # Combined = dense when no sparse
                chunk_copy["sparse_score"] = 0.0  # No sparse score
                chunks_with_combined.append(chunk_copy)
            
            merged_results[doc_id] = {
                "doc_title": data["doc_title"],
                "cloudinary_url": data["cloudinary_url"],
                "chunks": chunks_with_combined
            }
        
        debug_log(f"Step 4: Using dense scores as combined scores (no merge needed)", "HYBRID")
    
    # Prepare data for Stage 1 logging
    all_chunks_for_ranking = []
    for doc_id, data in merged_results.items():
        for chunk in data["chunks"]:
            all_chunks_for_ranking.append({
                "doc_id": doc_id,
                "chunk": chunk
            })
    
    # Sort by combined score and mark top K
    all_chunks_for_ranking.sort(key=lambda x: x["chunk"]["combined_score"], reverse=True)
    top_k_ids = {(item["doc_id"], item["chunk"].get('chunk_index')) for item in all_chunks_for_ranking[:settings.final_top_k]}
    
    # Add 'passed' flag to chunks for Stage 1
    doc_chunks_map_for_stage1 = {}
    for doc_id, data in merged_results.items():
        chunks_with_status = []
        for chunk in data["chunks"]:
            chunk_copy = chunk.copy()
            chunk_copy['passed'] = (doc_id, chunk.get('chunk_index')) in top_k_ids
            chunks_with_status.append(chunk_copy)
        
        doc_chunks_map_for_stage1[doc_id] = {
            'doc_title': data['doc_title'],
            'chunks': chunks_with_status
        }
    
    # Store Stage 1 data globally for retriever to access
    global _stage1_data
    _stage1_data = doc_chunks_map_for_stage1
    
    debug_log(f"\n{'='*80}", "HYBRID")
    debug_log(f"CHUNKS AFTER SCORING (Before pre-filtering to top-{settings.final_top_k})", "HYBRID")
    debug_log(f"{'='*80}", "HYBRID")
    
    for doc_id, data in merged_results.items():
        chunks = data["chunks"]
        debug_log(f"\n[HYBRID] Document {doc_id}: {data['doc_title']}", "HYBRID")
        debug_log(f"Total chunks: {len(chunks)}", "HYBRID")
        debug_log(f"{'Chunk':<8} {'Dense':<10} {'Sparse':<10} {'Combined':<10} {'Page':<6} {'Section':<40}", "HYBRID")
        debug_log(f"{'-'*90}", "HYBRID")
        
        for chunk in chunks[:50]:  # Show first 50 chunks per doc
            chunk_idx = chunk.get('chunk_index', '?')
            dense_score = chunk.get('dense_score', 0)
            sparse_score = chunk.get('sparse_score', 0)
            combined_score = chunk.get('combined_score', 0)
            page = chunk.get('start_page_num', '?')
            section = chunk.get('section_title', 'Unknown')[:40]
            
            debug_log(f"#{chunk_idx:<7} {dense_score:<10.4f} {sparse_score:<10.4f} {combined_score:<10.4f} {page:<6} {section}", "HYBRID")
        
        if len(chunks) > 50:
            debug_log(f"... and {len(chunks) - 50} more chunks", "HYBRID")
    
    debug_log(f"\n{'='*80}", "HYBRID")
    
    # Step 5: Pre-filter to top-K BEFORE reranking
    debug_log(f"Step 5: Pre-filtering to top-{settings.final_top_k}...", "HYBRID")
    pre_filtered_results = pre_filter_top_k(merged_results)
    
    # Step 6: Rerank (optional)
    if use_reranking:
        debug_log(f"Step 6: Reranking with {reranker_model}...", "HYBRID")
        final_results = rerank_chunks(pre_filtered_results, question, model_name=reranker_model)
    else:
        debug_log(f"Step 6: Skipping reranking (use_reranking=False)", "HYBRID")
        final_results = pre_filtered_results
    
    total_chunks = sum(len(v["chunks"]) for v in final_results.values())
    debug_log(f"Final results: {total_chunks} chunks from {len(final_results)} docs\n", "HYBRID")
    
    return final_results
    # This ensures all reranked chunks are in the pool for threshold filtering
    pre_filtered_results = pre_filter_top_k(merged_results)
    
    # Step 4: Rerank (optional)
    if use_reranking:
        final_results = rerank_chunks(pre_filtered_results, question, model_name=reranker_model)
    else:
        # Already filtered to top-k in pre_filter_top_k
        final_results = pre_filtered_results    
    total_chunks = sum(len(v["chunks"]) for v in final_results.values())
    debug_log(f"Final results: {total_chunks} chunks from {len(final_results)} docs\n", "HYBRID")
    
    return final_results


# ============================================================================
# BACKWARD COMPATIBILITY WRAPPER
# ============================================================================

def retrieve_chunks_for_all_docs_hybrid(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    use_deep_reranker: bool = False,  # NEW: Flag to use deep model
    keywords: List[str] = None  # NEW: Optional keywords from decomposer
) -> Dict[int, Dict]:
    """
    Drop-in replacement for retrieve_chunks_for_all_docs() from doc_qa_tool_structured.
    
    This function has the same signature and return format, so you can swap it in
    without changing any other code.
    
    Args:
        use_deep_reranker: If True, uses jina-reranker-v3 (slower, more accurate)
                          If False, uses ms-marco-MiniLM (faster, good quality)
        keywords: Optional list of important keywords for BM25 matching
    """
    settings = get_settings()
    
    # Choose reranker model based on flag
    reranker_model = settings.reranker_model_deep if use_deep_reranker else settings.reranker_model_fast
    
    debug_log(f"Using reranker: {reranker_model}", "HYBRID")
    
    # Use hybrid retrieval with reranking
    return hybrid_retrieve_chunks(
        chunk_db=chunk_db,
        document_ids=document_ids,
        question=question,
        use_reranking=True,
        reranker_model=reranker_model,
        keywords=keywords  # Pass keywords
    )


def hybrid_retrieve_chunks_no_rerank(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    keywords: List[str] = None,
) -> Dict[int, Dict]:
    """
    Fetch and score chunks WITHOUT reranking.
    Used by the 3-phase pipeline in retriever.py so that chunk fetching can run
    in parallel across sub-questions while reranking stays sequential.
    """
    return hybrid_retrieve_chunks(
        chunk_db=chunk_db,
        document_ids=document_ids,
        question=question,
        use_reranking=False,
        reranker_model=None,
        keywords=keywords,
    )
