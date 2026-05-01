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
        
        print(f"[HYBRID] Loading reranker model: {model_name} (first time only)", file=sys.stderr)
        
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
            model = CrossEncoder(
                model_name,
                use_auth_token=settings.hugging_face_token  # ✅ Use HF token for faster downloads
            )
            _reranker_models[model_name] = {'model': model, 'type': 'cross_encoder'}
        
        print(f"[HYBRID] Reranker model {model_name} loaded and cached", file=sys.stderr)
    
    return _reranker_models[model_name]


# ============================================================================
# DENSE RETRIEVAL (Existing Vector Search)
# ============================================================================

def dense_retrieve(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    top_k: int = None  # None means fetch ALL chunks
) -> Dict[int, Dict]:
    """
    Dense retrieval using cosine similarity (your existing method).
    
    Args:
        top_k: If None, fetches ALL chunks. Otherwise, fetches top-k per document.
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    from app.services.rag_service import retrieve_chunks_with_scores
    from shared.repos import documents_repo
    from concurrent.futures import ThreadPoolExecutor
    
    fetch_all = top_k is None
    print(f"[HYBRID] Dense retrieval: fetching {'ALL chunks' if fetch_all else f'top {top_k}'} per doc", file=sys.stderr)
    
    # Get document metadata
    docs = {d.id: d for d in documents_repo.get_by_ids(chunk_db, document_ids)}
    
    def fetch_one(doc_id):
        doc = docs.get(doc_id)
        if not doc:
            return doc_id, None
        
        try:
            # Fetch chunks - use large number if fetching all
            k = 10000 if fetch_all else top_k
            chunks = retrieve_chunks_with_scores(
                chunk_db,
                document_id=doc_id,
                question=question,
                top_k=k
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
    top_k: int = None  # None means fetch ALL chunks
) -> Dict[int, Dict]:
    """
    Sparse retrieval using BM25 keyword matching.
    
    BM25 is excellent for:
    - Exact keyword matches (e.g., "page 191", "174 MΩ")
    - Acronyms (e.g., "RCC-FSD")
    - Specific terms that embeddings might miss
    
    Args:
        top_k: If None, returns ALL chunks with BM25 scores. Otherwise, returns top-k per document.
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    from shared.models import DocumentChunk
    from shared.repos import documents_repo
    
    fetch_all = top_k is None
    print(f"[HYBRID] Sparse retrieval (BM25): fetching {'ALL chunks' if fetch_all else f'top {top_k}'} per doc", file=sys.stderr)
    
    # Get document metadata
    docs = {d.id: d for d in documents_repo.get_by_ids(chunk_db, document_ids)}
    
    results = {}
    
    for doc_id in document_ids:
        doc = docs.get(doc_id)
        if not doc:
            continue
        
        try:
            # Fetch ALL chunks for this document
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
            
            # Get top-k or all chunks
            if fetch_all:
                # Return ALL chunks with their scores
                indices = list(range(len(all_chunks)))
            else:
                # Get top-k chunks
                indices = np.argsort(scores)[::-1][:top_k]
            
            # Build result chunks with BM25 scores
            chunks = []
            for idx in indices:
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
            
            max_score = max(scores) if len(scores) > 0 else 0
            print(f"[HYBRID] BM25 for doc {doc_id}: {len(chunks)} chunks, max score={max_score:.2f}", file=sys.stderr)
            
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
    sparse_results: Dict[int, Dict]
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
    settings = get_settings()
    dense_weight = settings.dense_weight
    sparse_weight = settings.sparse_weight
    
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
    
    print(f"[HYBRID] Pre-filtering to top {top_k} chunks ACROSS ALL DOCUMENTS (based on combined score)", file=sys.stderr)
    
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
    
    print(f"[HYBRID] Selected top {len(top_chunks)} chunks from {len(all_chunks)} total chunks", file=sys.stderr)
    
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
    
    print(f"\n{'='*80}", file=sys.stderr)
    print(f"[HYBRID] ALL CHUNKS SORTED BY COMBINED SCORE", file=sys.stderr)
    print(f"[HYBRID] ✓ = Passed to reranker ({len(top_chunks)} chunks)", file=sys.stderr)
    print(f"[HYBRID] ✗ = Filtered out ({len(all_chunks) - len(top_chunks)} chunks)", file=sys.stderr)
    print(f"{'='*80}", file=sys.stderr)
    print(f"[HYBRID] {'Status':<8} {'Rank':<6} {'Doc':<6} {'Chunk':<8} {'Dense':<10} {'Sparse':<10} {'Combined':<10} {'Page':<6}", file=sys.stderr)
    print(f"[HYBRID] {'-'*80}", file=sys.stderr)
    
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
        
        print(f"[HYBRID] {status:<8} {rank:<6} {doc_id:<6} #{chunk_idx:<7} {dense_score:<10.4f} {sparse_score:<10.4f} {combined_score:<10.4f} {page:<6}", file=sys.stderr)
    
    print(f"{'='*80}", file=sys.stderr)
    print(f"[HYBRID] Summary: {len(top_chunks)} passed, {len(all_chunks) - len(top_chunks)} dropped", file=sys.stderr)
    print(f"{'='*80}\n", file=sys.stderr)
    
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
        print(f"[HYBRID] Doc {doc_id}: {len(data['chunks'])} chunks in top-{top_k}", file=sys.stderr)
    
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
        print(f"[HYBRID] Reranking with {model_name}", file=sys.stderr)
        
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
        
        print(f"[HYBRID] Reranking {len(all_chunks_with_metadata)} chunks across all documents", file=sys.stderr)
        
        # Get reranking scores based on model type
        if model_type == 'jina':
            # Jina v3 uses .rerank() method with query + list of documents
            texts = [item["chunk"]["text"] for item in all_chunks_with_metadata]
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
        print(f"[HYBRID] Reranked {len(all_chunks_with_metadata)} chunks, best score={best_score:.4f}", file=sys.stderr)
        
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
        print(f"[HYBRID] Top {min(5, len(all_chunks_with_metadata))} chunks after reranking:", file=sys.stderr)
        for i, item in enumerate(all_chunks_with_metadata[:5], 1):
            chunk = item["chunk"]
            print(f"[HYBRID]   {i}. Doc {item['doc_id']} - Chunk #{chunk.get('chunk_index', '?')}", file=sys.stderr)
            print(f"[HYBRID]      Rerank: {chunk['rerank_score']:.4f} | Dense: {chunk.get('dense_score', 0):.4f} | Sparse: {chunk.get('sparse_score', 0):.4f}", file=sys.stderr)
            print(f"[HYBRID]      Page: {chunk.get('start_page_num', '?')} | Section: {chunk.get('section_title', 'Unknown')[:50]}", file=sys.stderr)
            print(f"[HYBRID]      Preview: {chunk['text'][:100].replace(chr(10), ' ')}...", file=sys.stderr)
        
        return reranked
        
    except Exception as e:
        print(f"[HYBRID] Reranking failed: {e}, returning merged results", file=sys.stderr)
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
    reranker_model: str = None
) -> Dict[int, Dict]:
    """
    Hybrid retrieval combining dense + sparse + reranking.
    
    Pipeline:
    1. Dense retrieval (vector similarity) → ALL chunks per doc (PARALLEL with sparse)
    2. Sparse retrieval (BM25 keywords) → ALL chunks per doc (PARALLEL with dense)
    3. Merge with weighted scores → deduplicated pool
    4. Pre-filter to top-K across all docs
    5. Rerank with cross-encoder → final ranked chunks
    
    Args:
        chunk_db: Database session
        document_ids: List of document IDs to search
        question: User's question
        use_reranking: Whether to use cross-encoder reranking (slower but better)
        reranker_model: Which reranker model to use (if None, uses fast model)
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
        Each chunk has: chunk_index, text, score, start_page_num, end_page_num, section_title
    """
    settings = get_settings()
    
    # Use provided model or default to fast model
    if reranker_model is None:
        reranker_model = settings.reranker_model_fast
    
    print(f"\n[HYBRID] Starting hybrid retrieval for {len(document_ids)} docs", file=sys.stderr)
    print(f"[HYBRID] Question: {question[:100]}...", file=sys.stderr)
    
    # ✅ OPTIMIZATION 1: Parallelize Dense + Sparse retrieval
    from concurrent.futures import ThreadPoolExecutor
    
    print(f"[HYBRID] Running Dense + Sparse retrieval in parallel (fetching ALL chunks)...", file=sys.stderr)
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Submit both tasks simultaneously - fetch ALL chunks
        dense_future = executor.submit(dense_retrieve, chunk_db, document_ids, question, None)
        sparse_future = executor.submit(sparse_retrieve, chunk_db, document_ids, question, None)
        
        # Wait for both to complete
        dense_results = dense_future.result()
        sparse_results = sparse_future.result()
    
    print(f"[HYBRID] Dense + Sparse retrieval completed in parallel", file=sys.stderr)
    
    # Step 3: Merge results
    merged_results = merge_results(dense_results, sparse_results)
    
    # Prepare data for Stage 1 logging (will be stored in buffer, not written yet)
    # Collect all chunks across all documents
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
    # This is a workaround since hybrid_retrieval doesn't know the sub-question index
    global _stage1_data
    _stage1_data = doc_chunks_map_for_stage1
    
    print(f"\n{'='*80}", file=sys.stderr)
    print(f"[HYBRID] DENSE AND SPARSE CHUNKS (Before pre-filtering to top-{settings.final_top_k})", file=sys.stderr)
    print(f"{'='*80}", file=sys.stderr)
    
    for doc_id, data in merged_results.items():
        chunks = data["chunks"]
        print(f"\n[HYBRID] Document {doc_id}: {data['doc_title']}", file=sys.stderr)
        print(f"[HYBRID] Total chunks: {len(chunks)}", file=sys.stderr)
        print(f"[HYBRID] {'Chunk':<8} {'Dense':<10} {'Sparse':<10} {'Combined':<10} {'Page':<6} {'Section':<40}", file=sys.stderr)
        print(f"[HYBRID] {'-'*90}", file=sys.stderr)
        
        for chunk in chunks[:50]:  # Show first 50 chunks per doc
            chunk_idx = chunk.get('chunk_index', '?')
            dense_score = chunk.get('dense_score', 0)
            sparse_score = chunk.get('sparse_score', 0)
            combined_score = chunk.get('combined_score', 0)
            page = chunk.get('start_page_num', '?')
            section = chunk.get('section_title', 'Unknown')[:40]
            
            print(f"[HYBRID] #{chunk_idx:<7} {dense_score:<10.4f} {sparse_score:<10.4f} {combined_score:<10.4f} {page:<6} {section}", file=sys.stderr)
        
        if len(chunks) > 50:
            print(f"[HYBRID] ... and {len(chunks) - 50} more chunks", file=sys.stderr)
    
    print(f"\n{'='*80}", file=sys.stderr)
    
    # Step 3.5: Pre-filter to top-K BEFORE reranking (NEW)
    # This ensures all reranked chunks are in the pool for threshold filtering
    pre_filtered_results = pre_filter_top_k(merged_results)
    
    # Step 4: Rerank (optional)
    if use_reranking:
        final_results = rerank_chunks(pre_filtered_results, question, model_name=reranker_model)
    else:
        # Already filtered to top-k in pre_filter_top_k
        final_results = pre_filtered_results    
    total_chunks = sum(len(v["chunks"]) for v in final_results.values())
    print(f"[HYBRID] Final results: {total_chunks} chunks from {len(final_results)} docs\n", file=sys.stderr)
    
    return final_results


# ============================================================================
# BACKWARD COMPATIBILITY WRAPPER
# ============================================================================

def retrieve_chunks_for_all_docs_hybrid(
    chunk_db: Session,
    document_ids: List[int],
    question: str,
    use_deep_reranker: bool = False  # NEW: Flag to use deep model
) -> Dict[int, Dict]:
    """
    Drop-in replacement for retrieve_chunks_for_all_docs() from doc_qa_tool_structured.
    
    This function has the same signature and return format, so you can swap it in
    without changing any other code.
    
    Args:
        use_deep_reranker: If True, uses jina-reranker-v3 (slower, more accurate)
                          If False, uses ms-marco-MiniLM (faster, good quality)
    """
    settings = get_settings()
    
    # Choose reranker model based on flag
    reranker_model = settings.reranker_model_deep if use_deep_reranker else settings.reranker_model_fast
    
    print(f"[HYBRID] Using reranker: {reranker_model}", file=sys.stderr)
    
    # Use hybrid retrieval with reranking
    return hybrid_retrieve_chunks(
        chunk_db=chunk_db,
        document_ids=document_ids,
        question=question,
        use_reranking=True,
        reranker_model=reranker_model
    )
