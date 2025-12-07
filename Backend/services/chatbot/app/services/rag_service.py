from typing import List, Dict, Any
import google.generativeai as genai
from sqlalchemy.orm import Session
from app.core.config import get_settings
import sys
import json

settings = get_settings()

# Configure Gemini once (module import time)
# Use RAG-specific API key if available, otherwise fall back to main key
rag_api_key = settings.rag_google_api_key or settings.google_api_key
genai.configure(api_key=rag_api_key)

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
        return {"text": "I couldn't find relevant content in the selected document.", "sources": [], "follow_up_questions": []}
    
    print(f"[STEP 2] ✓ Found {len(chunks)} chunks", file=sys.stderr)
    
    # Step 3: Split chunks for answering vs follow-up generation
    print("\n[STEP 3] Splitting chunks for answer and follow-up...", file=sys.stderr)
    answer_chunk_count = max(2, min(3, len(chunks) - 1))  # Use 2-3 chunks for answering
    answer_chunks = chunks[:answer_chunk_count]
    followup_chunks = chunks[answer_chunk_count:]
    
    print(f"[STEP 3] Answer chunks: {len(answer_chunks)}", file=sys.stderr)
    print(f"[STEP 3] Follow-up chunks: {len(followup_chunks)}", file=sys.stderr)
    
    # Step 4: Generate answer and follow-up questions in one call
    print("\n[STEP 4] Generating answer with follow-up questions...", file=sys.stderr)
    result = _answer_with_followup(question, answer_chunks, followup_chunks, doc_title=None)
    
    print(f"[STEP 4] ✓ Generated answer (length: {len(result['answer'])} chars)", file=sys.stderr)
    print(f"[STEP 4] ✓ Generated {len(result['follow_up_questions'])} follow-up questions", file=sys.stderr)
    
    sources = [{"doc_id": document_id, "chunk_index": c["chunk_index"]} for c in answer_chunks]
    
    print("\n" + "="*80, file=sys.stderr)
    print(f"[DOC_QA] COMPLETED SUCCESSFULLY", file=sys.stderr)
    print(f"[DOC_QA] Answer preview: {result['answer'][:100]}...", file=sys.stderr)
    print(f"[DOC_QA] Follow-up questions: {result['follow_up_questions']}", file=sys.stderr)
    print("="*80 + "\n", file=sys.stderr)
    
    return {
        "text": result['answer'], 
        "sources": sources,
        "follow_up_questions": result['follow_up_questions']
    }

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
            if hasattr(c, 'embedding') and c.embedding is not None:
                try:
                    if hasattr(c.embedding, '__len__') and len(c.embedding) > 0:
                        import numpy as np
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

def _answer_with_followup(
    question: str, 
    answer_chunks: List[Dict[str, Any]], 
    followup_chunks: List[Dict[str, Any]],
    doc_title: str | None = None
) -> Dict[str, Any]:
    """Generate an answer and follow-up questions in a single LLM call."""
    
    print(f"  → Building context from {len(answer_chunks)} answer chunks...", file=sys.stderr)
    
    # Build answer context
    answer_context = ""
    for i, ch in enumerate(answer_chunks, 1):
        section = ch.get("section_title") or "Section"
        chunk_text = ch['text']
        answer_context += f"\n--- Answer Chunk {i} ({section}) ---\n{chunk_text}\n"
    
    # Build follow-up context
    followup_context = ""
    if followup_chunks:
        print(f"  → Building context from {len(followup_chunks)} follow-up chunks...", file=sys.stderr)
        for i, ch in enumerate(followup_chunks, 1):
            section = ch.get("section_title") or "Section"
            chunk_text = ch['text']
            followup_context += f"\n--- Follow-up Chunk {i} ({section}) ---\n{chunk_text}\n"
    
    print(f"  → Total answer context length: {len(answer_context)} chars", file=sys.stderr)
    print(f"  → Total follow-up context length: {len(followup_context)} chars", file=sys.stderr)

    prompt = f"""
You are a helpful assistant answering questions about one selected document.
Document: {doc_title or 'Selected Document'}

TASK 1 - ANSWER THE QUESTION:
Use ONLY the following context to answer the user's question:

{answer_context}

User Question:
{question}

Answer ONLY from the context above. If not found, say you don't know. Be concise and accurate.

TASK 2 - GENERATE FOLLOW-UP QUESTIONS:
{"Based on the additional context below, generate 2-3 specific follow-up questions that:" if followup_context else "Based on any unused information from the answer context, generate 1-2 specific follow-up questions that:"}
- Are based on information present in the {"follow-up chunks" if followup_context else "context"}
- Are NOT already fully covered in your main answer
- Would help the user explore related topics or details from the document
- Are specific and directly answerable from the document

{"Additional Context for Follow-up Questions:" if followup_context else ""}
{followup_context}

OUTPUT FORMAT (JSON):
{{
  "answer": "Your concise answer here",
  "follow_up_questions": [
    "First follow-up question?",
    "Second follow-up question?"
  ]
}}

IMPORTANT: Return ONLY valid JSON, no preamble or markdown.
"""
    
    print(f"  → Prompt length: {len(prompt)} chars", file=sys.stderr)
    print(f"  → Calling LLM ({settings.llm_model})...", file=sys.stderr)
    
    try:
        model = genai.GenerativeModel(settings.llm_model)
        resp = model.generate_content(prompt)
        
        response_text = resp.text.strip()
        print(f"  → LLM Response length: {len(response_text)} chars", file=sys.stderr)
        
        # Clean up JSON response (remove markdown if present)
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        # Parse JSON response
        result = json.loads(response_text)
        
        answer = result.get("answer", "No answer provided.")
        follow_up_questions = result.get("follow_up_questions", [])
        
        print(f"  → Answer preview: {answer[:200]}...", file=sys.stderr)
        print(f"  → Follow-up questions: {follow_up_questions}", file=sys.stderr)
        
        return {
            "answer": answer,
            "follow_up_questions": follow_up_questions
        }
        
    except json.JSONDecodeError as e:
        print(f"  ✗ JSON PARSE ERROR: {e}", file=sys.stderr)
        print(f"  → Raw response: {response_text}", file=sys.stderr)
        # Fallback: return just the response as answer
        return {
            "answer": response_text,
            "follow_up_questions": []
        }
    except Exception as e:
        print(f"  ✗ LLM ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            "answer": f"I encountered an error while generating the answer: {str(e)}",
            "follow_up_questions": []
        }