from typing import List, Dict, Any
from sqlalchemy.orm import Session
import sys
import json

from shared.llm import embed_single, create_llm_provider
from app.core.config import get_settings

settings = get_settings()
settings = get_settings()

def doc_qa(chunk_db: Session, *, document_id: int, question: str, top_k: int = 5) -> Dict[str, Any]:
    print("\n" + "="*80, file=sys.stderr)
    print(f"[DOC_QA] Starting document Q&A", file=sys.stderr)
    print(f"[DOC_QA] Document ID: {document_id}", file=sys.stderr)
    print(f"[DOC_QA] Question: {question}", file=sys.stderr)
    print(f"[DOC_QA] Top K: {top_k}", file=sys.stderr)
    print("="*80, file=sys.stderr)
    
    # Step 1: Generate query embedding
    print("\n[STEP 1] Generating query embedding...", file=sys.stderr)
    q_emb = embed_single(
        text=question,
        api_key=settings.google_api_key,
        embedding_model=settings.embedding_model,
        task_type="retrieval_query",
        output_dimensionality=3072
    )
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
    print("answer chunks")
    print(answer_chunks)
    print("followup chunks")
    print(followup_chunks)
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
You are a helpful assistant answering questions about a document.

CONTEXT FROM DOCUMENT:
{answer_context}

USER QUESTION:
{question}

INSTRUCTIONS:
1. Read the context carefully and extract information that answers the user's question
2. If the context contains relevant information, provide a clear and direct answer
3. ONLY say "I don't know" if the context truly does not contain ANY information related to the question
4. Be concise but complete in your answer
5. Use the exact information from the context

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
  "answer": "Your answer here based on the context",
  "follow_up_questions": [
    "First follow-up question?",
    "Second follow-up question?"
  ]
}}

IMPORTANT: Return ONLY valid JSON, no preamble or markdown.
"""
    
    print(f"  → Prompt length: {len(prompt)} chars", file=sys.stderr)
    print(f"  → Calling LLM ({settings.llm_provider}/{settings.llm_model})...", file=sys.stderr)
    
    try:
        # Create LLM provider using shared utility
        llm = create_llm_provider(
            llm_provider=settings.llm_provider,
            llm_model=settings.llm_model,
            google_api_key=settings.google_api_key,
            openai_api_key=settings.openai_api_key
        )
        
        # Use generate_json for automatic JSON parsing
        result = llm.generate_json(prompt)
        
        print(f"  → LLM Response received", file=sys.stderr)
        
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
        # Fallback: return error message
        return {
            "answer": "I encountered an error parsing the response. Please try again.",
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


def retrieve_chunks_with_scores(
    chunk_db: Session,
    *,
    document_id: int,
    question: str,
    top_k: int = 5
) -> List[Dict[str, Any]]:
    import numpy as np
    try:
        # embed_single is already imported from shared.llm at top of file
        # use retrieval_query task type for questions
        q_emb = embed_single(
            text=question,
            api_key=settings.google_api_key,
            embedding_model=settings.embedding_model,
            task_type="retrieval_query",
            output_dimensionality=3072
        )

        from shared.models.Document import DocumentChunk

        chunks = (
            chunk_db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.embedding.cosine_distance(q_emb))
            .limit(top_k)
            .all()
        )

        if not chunks:
            return []

        q_emb_np = np.array(q_emb)
        results = []

        for chunk in chunks:
            try:
                c_emb_np = np.array(chunk.embedding)
                cosine_sim = np.dot(q_emb_np, c_emb_np) / (
                    np.linalg.norm(q_emb_np) * np.linalg.norm(c_emb_np)
                )
                results.append({
                    'text': chunk.text,
                    'score': float(cosine_sim),
                    'chunk_index': chunk.chunk_index,
                    'section_title': getattr(chunk, 'section_title', None)
                })
            except Exception as e:
                print(f"[retrieve_chunks_with_scores] Score error for chunk {chunk.chunk_index}: {e}", file=sys.stderr)
                continue

        return results

    except Exception as e:
        print(f"[retrieve_chunks_with_scores] Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return []
