from typing import List, Dict, Any
import google.generativeai as genai
from sqlalchemy.orm import Session
from app.core.config import get_settings
import sys
import json

settings = get_settings()

# Configure Gemini once (module import time)
genai.configure(api_key=settings.google_api_key)

def doc_qa(chunk_db: Session, *, document_id: int, question: str, top_k: int = 5) -> Dict[str, Any]:
    print("\n" + "="*80, file=sys.stderr)
    print(f"[DOC_QA] Starting document Q&A", file=sys.stderr)
    print(f"[DOC_QA] Document ID: {document_id}", file=sys.stderr)
    print(f"[DOC_QA] Question: {question}", file=sys.stderr)
    print(f"[DOC_QA] Top K: {top_k}", file=sys.stderr)
    print("="*80, file=sys.stderr)
    
    # Step 1: Generate query embedding
    print("\n[STEP 1] Generating query embedding...", file=sys.stderr)
    q_emb = _embed_query(question)
    print(f"[STEP 1] ✓ Generated embedding (dimension: {len(q_emb)})", file=sys.stderr)
    print(f"[STEP 1] First 5 values: {q_emb[:5]}", file=sys.stderr)
    
    # Step 2: Search for similar chunks
    print("\n[STEP 2] Searching for similar chunks...", file=sys.stderr)
    chunks = _search_similar_chunks(chunk_db, document_id=document_id, query_embedding=q_emb, top_k=top_k)
    
    if not chunks:
        print("[STEP 2] ✗ No chunks found!", file=sys.stderr)
        return {"text": "I couldn't find relevant content in the selected document.", "sources": []}
    
    print(f"[STEP 2] ✓ Found {len(chunks)} chunks", file=sys.stderr)
    
    # Step 3: Generate answer
    print("\n[STEP 3] Generating answer with context...", file=sys.stderr)
    answer = _answer_with_context(question, chunks, doc_title=None)
    print(f"[STEP 3] ✓ Generated answer (length: {len(answer)} chars)", file=sys.stderr)
    
    sources = [{"doc_id": document_id, "chunk_index": c["chunk_index"]} for c in chunks]
    
    print("\n" + "="*80, file=sys.stderr)
    print(f"[DOC_QA] COMPLETED SUCCESSFULLY", file=sys.stderr)
    print(f"[DOC_QA] Answer preview: {answer[:100]}...", file=sys.stderr)
    print("="*80 + "\n", file=sys.stderr)
    
    return {"text": answer, "sources": sources}

def _embed_query(query: str) -> List[float]:
    """Generate embedding for a query string."""
    try:
        print(f"  → Calling embed_content API...", file=sys.stderr)
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=query,
            task_type="retrieval_query"
        )
        
        print(f"  → API Response Type: {type(result)}", file=sys.stderr)
        
        # Handle different response formats
        if hasattr(result, 'embedding'):
            embedding = result.embedding
            print(f"  → Accessed via .embedding attribute", file=sys.stderr)
        elif isinstance(result, dict) and 'embedding' in result:
            embedding = result['embedding']
            print(f"  → Accessed via ['embedding'] key", file=sys.stderr)
        elif isinstance(result, dict) and 'embeddings' in result:
            embedding = result['embeddings'][0]
            print(f"  → Accessed via ['embeddings'][0]", file=sys.stderr)
        elif isinstance(result, list):
            embedding = result
            print(f"  → Result is already a list", file=sys.stderr)
        else:
            print(f"  ✗ ERROR: Unexpected structure!", file=sys.stderr)
            print(f"  → Result keys (if dict): {result.keys() if isinstance(result, dict) else 'N/A'}", file=sys.stderr)
            raise ValueError(f"Unexpected embedding response structure: {type(result)}")
        
        return embedding
        
    except Exception as e:
        print(f"  ✗ EMBEDDING ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        raise

def _search_similar_chunks(
    chunk_db: Session, 
    *, 
    document_id: int, 
    query_embedding: List[float], 
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """Search for similar chunks using vector similarity."""
    try:
        print(f"  → Querying database for document_id={document_id}...", file=sys.stderr)
        
        # First, check if document has any chunks
        from shared.models.Document import DocumentChunk
        total_chunks = chunk_db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).count()
        print(f"  → Total chunks in document: {total_chunks}", file=sys.stderr)
        
        if total_chunks == 0:
            print(f"  ✗ WARNING: No chunks found for document_id={document_id}", file=sys.stderr)
            return []
        
        # Perform similarity search
        chunks = (
            chunk_db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
            .limit(top_k)
            .all()
        )
        
        print(f"  → Retrieved {len(chunks)} chunks", file=sys.stderr)
        
        # Log details of each retrieved chunk
        result_chunks = []
        for idx, c in enumerate(chunks, 1):
            chunk_dict = {
                "chunk_index": c.chunk_index,
                "text": c.text,
                "section_title": getattr(c, "section_title", None),
            }
            result_chunks.append(chunk_dict)
            
            print(f"\n  [CHUNK {idx}]", file=sys.stderr)
            print(f"    Index: {c.chunk_index}", file=sys.stderr)
            print(f"    Section: {chunk_dict['section_title']}", file=sys.stderr)
            print(f"    Text Length: {len(c.text)} chars", file=sys.stderr)
            print(f"    Text Preview: {c.text[:150]}...", file=sys.stderr)
            
            # Calculate approximate similarity score if possible
            # FIXED: Check if embedding exists properly
            if hasattr(c, 'embedding') and c.embedding is not None:
                try:
                    # Check if it's an array/list with elements
                    if hasattr(c.embedding, '__len__') and len(c.embedding) > 0:
                        import numpy as np
                        # Convert to numpy arrays for calculation
                        q_emb_np = np.array(query_embedding)
                        c_emb_np = np.array(c.embedding)
                        
                        cosine_sim = np.dot(q_emb_np, c_emb_np) / (np.linalg.norm(q_emb_np) * np.linalg.norm(c_emb_np))
                        print(f"    Similarity Score: {cosine_sim:.4f}", file=sys.stderr)
                except Exception as sim_error:
                    print(f"    Similarity Score: (calculation failed: {sim_error})", file=sys.stderr)
        
        return result_chunks
        
    except Exception as e:
        print(f"  ✗ SEARCH ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        raise

def _answer_with_context(
    question: str, 
    context_chunks: List[Dict[str, Any]], 
    doc_title: str | None = None
) -> str:
    """Generate an answer using LLM with retrieved context."""
    
    print(f"  → Building context from {len(context_chunks)} chunks...", file=sys.stderr)
    
    context_text = ""
    total_context_length = 0
    
    for i, ch in enumerate(context_chunks, 1):
        section = ch.get("section_title") or "Section"
        chunk_text = ch['text']
        context_text += f"\n--- Chunk {i} ({section}) ---\n{chunk_text}\n"
        total_context_length += len(chunk_text)
    
    print(f"  → Total context length: {total_context_length} chars", file=sys.stderr)

    prompt = f"""
You are a helpful assistant answering questions about one selected document.
Document: {doc_title or 'Selected Document'}

Retrieved Context:
{context_text}

User Question:
{question}

Instructions:
Answer ONLY from the context above. If not found, say you don't know. Be concise.
"""
    
    print(f"  → Prompt length: {len(prompt)} chars", file=sys.stderr)
    print(f"  → Calling LLM ({settings.llm_model})...", file=sys.stderr)
    
    try:
        model = genai.GenerativeModel(settings.llm_model)
        resp = model.generate_content(prompt)
        
        answer = resp.text
        print(f"  → LLM Response length: {len(answer)} chars", file=sys.stderr)
        print(f"  → Response preview: {answer[:200]}...", file=sys.stderr)
        
        return answer
        
    except Exception as e:
        print(f"  ✗ LLM ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return f"I encountered an error while generating the answer: {str(e)}"