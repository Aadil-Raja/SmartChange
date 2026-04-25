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

# Load environment variables (for HF_TOKEN)
from dotenv import load_dotenv
load_dotenv()

# Set HuggingFace token if available
if os.getenv('HF_TOKEN'):
    os.environ['HUGGING_FACE_HUB_TOKEN'] = os.getenv('HF_TOKEN')


# ============================================================================
# CONFIGURATION
# ============================================================================

# Retrieval strategy weights
DENSE_WEIGHT = 0.7   # 70% weight to vector similarity
SPARSE_WEIGHT = 0.3  # 30% weight to BM25 keyword matching

# Retrieval pool sizes
DENSE_TOP_K = 20     # Fetch top 20 from vector search
SPARSE_TOP_K = 20    # Fetch top 20 from BM25 search
FINAL_TOP_K = 10     # After reranking, keep top 10

# Reranking model
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"  # Fast, good quality
# Alternative: "cross-encoder/ms-marco-MiniLM-L-12-v2" (slower, better quality)

# Global model cache (loaded once, reused for all requests)
_reranker_model = None


def _get_reranker_model(model_name: str = RERANKER_MODEL):
    """Get or load the reranker model (cached globally)."""
    global _reranker_model
    
    if _reranker_model is None:
        from sentence_transformers import CrossEncoder
        import os
        
        # Set HuggingFace token if available
        hf_token = os.environ.get('HF_TOKEN')
        if hf_token:
            os.environ['HUGGING_FACE_HUB_TOKEN'] = hf_token
        
        print(f"[HYBRID] Loading reranker model: {model_name} (first time only)", file=sys.stderr)
        _reranker_model = CrossEncoder(model_name)
        print(f"[HYBRID] Reranker model loaded and cached", file=sys.stderr)
    
    return _reranker_model


# ============================================================================
# DENSE RETRIEVAL (Existing Vector Search)
# ============================================================================

def dense_retrieve(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    top_k: int = DENSE_TOP_K
) -> Dict[int, Dict]:
    """
    Dense retrieval using cosine similarity (your existing method).
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    from app.services.rag_service import retrieve_chunks_with_scores
    from shared.repos import documents_repo
    from concurrent.futures import ThreadPoolExecutor
    
    print(f"[HYBRID] Dense retrieval: fetching top {top_k} per doc", file=sys.stderr)
    
    # Get document metadata
    docs = {d.id: d for d in documents_repo.get_by_ids(chunk_db, document_ids)}
    
    def fetch_one(doc_id):
        doc = docs.get(doc_id)
        if not doc:
            return doc_id, None
        
        try:
            chunks = retrieve_chunks_with_scores(
                chunk_db,
                document_id=doc_id,
                question=question,
                top_k=top_k
            )
            
            if not chunks:
                return doc_id, None
            
            return doc_id, {
                "doc_title": doc.title,
                "cloudinary_url": doc.cloudinary_url,
                "chunks": chunks
            }
        except Exception as e:
            print(f"[HYBRID] Dense retrieval error for doc {doc_id}: {e}", file=sys.stderr)
            return doc_id, None
    
    # Parallel execution
    with ThreadPoolExecutor(max_workers=len(document_ids)) as executor:
        results = dict(executor.map(fetch_one, document_ids))
    
    # Filter out None values
    filtered = {k: v for k, v in results.items() if v is not None}
    
    total_chunks = sum(len(v["chunks"]) for v in filtered.values())
    print(f"[HYBRID] Dense retrieval: {total_chunks} chunks from {len(filtered)} docs", file=sys.stderr)
    
    return filtered


# ============================================================================
# SPARSE RETRIEVAL (BM25 Keyword Search)
# ============================================================================

def sparse_retrieve(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    top_k: int = SPARSE_TOP_K
) -> Dict[int, Dict]:
    """
    Sparse retrieval using BM25 keyword matching.
    
    BM25 is excellent for:
    - Exact keyword matches (e.g., "page 191", "174 MΩ")
    - Acronyms (e.g., "RCC-FSD")
    - Specific terms that embeddings might miss
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    from shared.models import DocumentChunk
    from shared.repos import documents_repo
    
    print(f"[HYBRID] Sparse retrieval (BM25): fetching top {top_k} per doc", file=sys.stderr)
    
    # Get document metadata
    docs = {d.id: d for d in documents_repo.get_by_ids(chunk_db, document_ids)}
    
    results = {}
    
    for doc_id in document_ids:
        doc = docs.get(doc_id)
        if not doc:
            continue
        
        try:
            # Fetch ALL chunks for this document (we'll rank them with BM25)
            all_chunks = chunk_db.query(DocumentChunk).filter(
                DocumentChunk.document_id == doc_id
            ).all()
            
            if not all_chunks:
                continue
            
            # Tokenize corpus (simple whitespace tokenization)
            corpus = [chunk.text.lower().split() for chunk in all_chunks]
            
            # Build BM25 index
            bm25 = BM25Okapi(corpus)
            
            # Tokenize query
            query_tokens = question.lower().split()
            
            # Get BM25 scores for all chunks
            scores = bm25.get_scores(query_tokens)
            
            # Get top-k chunks
            top_indices = np.argsort(scores)[::-1][:top_k]
            
            # Build result chunks with BM25 scores
            chunks = []
            for idx in top_indices:
                chunk = all_chunks[idx]
                chunks.append({
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "score": float(scores[idx]),  # BM25 score (not cosine similarity)
                    "start_page_num": chunk.start_page_num,
                    "end_page_num": chunk.end_page_num,
                    "section_title": chunk.section_title,
                    "retrieval_method": "bm25"  # Tag for debugging
                })
            
            if chunks:
                results[doc_id] = {
                    "doc_title": doc.title,
                    "cloudinary_url": doc.cloudinary_url,
                    "chunks": chunks
                }
            
            print(f"[HYBRID] BM25 for doc {doc_id}: {len(chunks)} chunks, top score={scores[top_indices[0]]:.2f}", file=sys.stderr)
            
        except Exception as e:
            print(f"[HYBRID] BM25 error for doc {doc_id}: {e}", file=sys.stderr)
            continue
    
    total_chunks = sum(len(v["chunks"]) for v in results.values())
    print(f"[HYBRID] Sparse retrieval: {total_chunks} chunks from {len(results)} docs", file=sys.stderr)
    
    return results


# ============================================================================
# MERGE DENSE + SPARSE RESULTS
# ============================================================================

def merge_results(
    dense_results: Dict[int, Dict],
    sparse_results: Dict[int, Dict],
    dense_weight: float = DENSE_WEIGHT,
    sparse_weight: float = SPARSE_WEIGHT
) -> Dict[int, Dict]:
    """
    Merge dense and sparse results with weighted scoring.
    
    Strategy:
    1. Normalize scores from both methods to [0, 1]
    2. Combine with weighted average
    3. Deduplicate by (doc_id, chunk_index)
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    print(f"[HYBRID] Merging results (dense_weight={dense_weight}, sparse_weight={sparse_weight})", file=sys.stderr)
    
    merged = {}
    
    # Get all document IDs
    all_doc_ids = set(dense_results.keys()) | set(sparse_results.keys())
    
    for doc_id in all_doc_ids:
        dense_data = dense_results.get(doc_id)
        sparse_data = sparse_results.get(doc_id)
        
        # Get document metadata (prefer dense, fallback to sparse)
        doc_title = (dense_data or sparse_data)["doc_title"]
        cloudinary_url = (dense_data or sparse_data)["cloudinary_url"]
        
        # Build chunk map for deduplication
        chunk_map = {}  # (doc_id, chunk_index) -> chunk with combined score
        
        # Add dense chunks
        if dense_data:
            dense_chunks = dense_data["chunks"]
            # Normalize dense scores to [0, 1] (they're already cosine similarity)
            max_dense = max(c["score"] for c in dense_chunks) if dense_chunks else 1.0
            
            for chunk in dense_chunks:
                key = (doc_id, chunk["chunk_index"])
                normalized_score = chunk["score"] / max_dense if max_dense > 0 else 0
                
                chunk_map[key] = {
                    **chunk,
                    "combined_score": normalized_score * dense_weight,
                    "dense_score": chunk["score"],
                    "sparse_score": 0.0
                }
        
        # Add/merge sparse chunks
        if sparse_data:
            sparse_chunks = sparse_data["chunks"]
            # Normalize BM25 scores to [0, 1]
            max_sparse = max(c["score"] for c in sparse_chunks) if sparse_chunks else 1.0
            
            for chunk in sparse_chunks:
                key = (doc_id, chunk["chunk_index"])
                normalized_score = chunk["score"] / max_sparse if max_sparse > 0 else 0
                
                if key in chunk_map:
                    # Chunk exists from dense retrieval - add sparse score
                    chunk_map[key]["combined_score"] += normalized_score * sparse_weight
                    chunk_map[key]["sparse_score"] = chunk["score"]
                else:
                    # New chunk from sparse retrieval only
                    chunk_map[key] = {
                        **chunk,
                        "combined_score": normalized_score * sparse_weight,
                        "dense_score": 0.0,
                        "sparse_score": chunk["score"]
                    }
        
        # Sort by combined score
        sorted_chunks = sorted(
            chunk_map.values(),
            key=lambda c: c["combined_score"],
            reverse=True
        )
        
        if sorted_chunks:
            merged[doc_id] = {
                "doc_title": doc_title,
                "cloudinary_url": cloudinary_url,
                "chunks": sorted_chunks
            }
            
            print(f"[HYBRID] Doc {doc_id}: {len(sorted_chunks)} unique chunks after merge", file=sys.stderr)
    
    return merged


# ============================================================================
# RERANKING WITH CROSS-ENCODER
# ============================================================================

def rerank_chunks(
    merged_results: Dict[int, Dict],
    question: str,
    top_k: int = FINAL_TOP_K,
    model_name: str = RERANKER_MODEL
) -> Dict[int, Dict]:
    """
    Rerank merged results using a cross-encoder model.
    
    Cross-encoders are more accurate than bi-encoders (embeddings) because they
    process query + document together, but they're slower. That's why we use them
    only for reranking a small pool of candidates.
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}] with top-k chunks per doc
    """
    try:
        print(f"[HYBRID] Reranking with {model_name}", file=sys.stderr)
        
        # Load cross-encoder model (cached globally, loaded only once)
        reranker = _get_reranker_model(model_name)
        
        reranked = {}
        
        for doc_id, data in merged_results.items():
            chunks = data["chunks"]
            
            if not chunks:
                continue
            
            # Prepare query-document pairs for cross-encoder
            pairs = [[question, chunk["text"]] for chunk in chunks]
            
            # Get reranking scores
            rerank_scores = reranker.predict(pairs)
            
            # Add rerank scores to chunks
            for chunk, score in zip(chunks, rerank_scores):
                chunk["rerank_score"] = float(score)
            
            # Sort by rerank score and keep top-k
            sorted_chunks = sorted(
                chunks,
                key=lambda c: c["rerank_score"],
                reverse=True
            )[:top_k]
            
            # Update final score to be rerank score
            for chunk in sorted_chunks:
                chunk["score"] = chunk["rerank_score"]  # Replace combined_score with rerank_score
            
            reranked[doc_id] = {
                "doc_title": data["doc_title"],
                "cloudinary_url": data["cloudinary_url"],
                "chunks": sorted_chunks
            }
            
            print(f"[HYBRID] Doc {doc_id}: reranked to top {len(sorted_chunks)} chunks, best score={sorted_chunks[0]['rerank_score']:.4f}", file=sys.stderr)
            
            # ✅ NEW: Print detailed chunk information
            print(f"[HYBRID] Doc {doc_id} - Top {min(3, len(sorted_chunks))} chunks after reranking:", file=sys.stderr)
            for i, chunk in enumerate(sorted_chunks[:3], 1):
                print(f"[HYBRID]   Chunk {i}:", file=sys.stderr)
                print(f"[HYBRID]     Rerank score: {chunk['rerank_score']:.4f}", file=sys.stderr)
                print(f"[HYBRID]     Dense score:  {chunk.get('dense_score', 0):.4f}", file=sys.stderr)
                print(f"[HYBRID]     Sparse score: {chunk.get('sparse_score', 0):.4f}", file=sys.stderr)
                print(f"[HYBRID]     Page: {chunk.get('start_page_num', '?')}", file=sys.stderr)
                print(f"[HYBRID]     Section: {chunk.get('section_title', 'Unknown')[:50]}", file=sys.stderr)
                print(f"[HYBRID]     Text preview: {chunk['text'][:150].replace(chr(10), ' ')}...", file=sys.stderr)
                print(f"[HYBRID]", file=sys.stderr)
        
        return reranked
        
    except Exception as e:
        print(f"[HYBRID] Reranking failed: {e}, returning merged results", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        # Fallback: return merged results without reranking, but limit to top_k
        fallback = {}
        for doc_id, data in merged_results.items():
            fallback[doc_id] = {
                **data,
                "chunks": data["chunks"][:top_k]
            }
        return fallback


# ============================================================================
# MAIN HYBRID RETRIEVAL FUNCTION
# ============================================================================

def hybrid_retrieve_chunks(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    top_k: int = FINAL_TOP_K,
    use_reranking: bool = True
) -> Dict[int, Dict]:
    """
    Hybrid retrieval combining dense + sparse + reranking.
    
    Pipeline:
    1. Dense retrieval (vector similarity) → top 20 per doc (PARALLEL with sparse)
    2. Sparse retrieval (BM25 keywords) → top 20 per doc (PARALLEL with dense)
    3. Merge with weighted scores → deduplicated pool
    4. Rerank with cross-encoder → final top-k per doc
    
    Args:
        chunk_db: Database session
        document_ids: List of document IDs to search
        question: User's question
        top_k: Final number of chunks to return per document
        use_reranking: Whether to use cross-encoder reranking (slower but better)
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
        Each chunk has: chunk_index, text, score, start_page_num, end_page_num, section_title
    """
    print(f"\n[HYBRID] Starting hybrid retrieval for {len(document_ids)} docs", file=sys.stderr)
    print(f"[HYBRID] Question: {question[:100]}...", file=sys.stderr)
    
    # ✅ OPTIMIZATION 1: Parallelize Dense + Sparse retrieval
    from concurrent.futures import ThreadPoolExecutor
    
    print(f"[HYBRID] Running Dense + Sparse retrieval in parallel...", file=sys.stderr)
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Submit both tasks simultaneously
        dense_future = executor.submit(dense_retrieve, chunk_db, document_ids, question, DENSE_TOP_K)
        sparse_future = executor.submit(sparse_retrieve, chunk_db, document_ids, question, SPARSE_TOP_K)
        
        # Wait for both to complete
        dense_results = dense_future.result()
        sparse_results = sparse_future.result()
    
    print(f"[HYBRID] Dense + Sparse retrieval completed in parallel", file=sys.stderr)
    
    # Step 3: Merge results
    merged_results = merge_results(dense_results, sparse_results)
    
    # Step 4: Rerank (optional)
    if use_reranking:
        final_results = rerank_chunks(merged_results, question, top_k=top_k)
    else:
        # Just take top-k from merged results
        final_results = {}
        for doc_id, data in merged_results.items():
            final_results[doc_id] = {
                **data,
                "chunks": data["chunks"][:top_k]
            }
    
    total_chunks = sum(len(v["chunks"]) for v in final_results.values())
    print(f"[HYBRID] Final results: {total_chunks} chunks from {len(final_results)} docs\n", file=sys.stderr)
    
    return final_results


# ============================================================================
# BACKWARD COMPATIBILITY WRAPPER
# ============================================================================

def retrieve_chunks_for_all_docs_hybrid(
    chunk_db: Session,
    document_ids: List[int],
    question: str
) -> Dict[int, Dict]:
    """
    Drop-in replacement for retrieve_chunks_for_all_docs() from doc_qa_tool_structured.
    
    This function has the same signature and return format, so you can swap it in
    without changing any other code.
    """
    from app.core.config import get_settings
    settings = get_settings()
    
    # Use hybrid retrieval with reranking
    return hybrid_retrieve_chunks(
        chunk_db=chunk_db,
        document_ids=document_ids,
        question=question,
        top_k=settings.max_chunks_per_doc,
        use_reranking=True
    )
