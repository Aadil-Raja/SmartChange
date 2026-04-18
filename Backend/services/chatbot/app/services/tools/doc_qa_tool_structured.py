# app/services/tools/doc_qa_tool_structured.py
"""
V2 doc QA tool with LangChain structured output - returns structured dict with answer, citations, has_contradiction.
Used by agent_service_v2 for the /respond-v2 endpoint.

This version uses LangChain's with_structured_output() to enforce schema compliance
at the framework level instead of relying on prompt-based JSON format instructions.

Filtering strategy:
- Best doc threshold:  max(0.60, best_score * 0.75)
- Other docs threshold: max(0.60, best_score * 0.85)
- LLM verifies which chunk IDs it actually used → secondary citation filter
"""
from pydantic import BaseModel, Field
from langchain.tools import tool
from typing import List, Dict, Tuple
import sys
import json

from .schemas import LLMDocQAOutput

ABSOLUTE_FLOOR   = 0.60   # Hard minimum cosine similarity for any chunk
SAME_DOC_RATIO   = 0.75   # Threshold ratio for the best-scoring document
OTHER_DOC_RATIO  = 0.85   # Stricter threshold ratio for all other documents
TOP_K_PER_DOC    = 5      # Retrieve more candidates per doc


class DocQAToolArgs(BaseModel):
    question: str = Field(description="The question to answer from the selected documents")


# ============================================================================
# STEP 1: CHUNK RETRIEVAL
# ============================================================================

def retrieve_chunks_for_all_docs(chunk_db, document_ids: List[int], question: str) -> Dict:
    """
    Retrieve top-k chunks from each document in parallel.
    
    Returns:
        Dict[doc_id, {doc_title, cloudinary_url, chunks}]
    """
    from app.services.rag_service import retrieve_chunks_with_scores
    from shared.repos import documents_repo
    from concurrent.futures import ThreadPoolExecutor
    
    # Single bulk DB query instead of N individual queries
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
                top_k=TOP_K_PER_DOC
            )
            
            if not chunks:
                return doc_id, None
            
            return doc_id, {
                "doc_title": doc.title,
                "cloudinary_url": doc.cloudinary_url,
                "chunks": chunks
            }
        except Exception:
            return doc_id, None
    
    # Parallel execution
    with ThreadPoolExecutor(max_workers=len(document_ids)) as executor:
        results = dict(executor.map(fetch_one, document_ids))
    
    # Filter out None values
    return {k: v for k, v in results.items() if v is not None}


# ============================================================================
# STEP 2: THRESHOLD FILTERING
# ============================================================================

def calculate_thresholds(raw_results: Dict) -> Tuple[float, int, float, float]:
    """
    Calculate tiered thresholds based on best score.
    
    Returns:
        (best_score, best_doc_id, same_doc_threshold, other_doc_threshold)
    """
    best_score = 0.0
    best_doc_id = None
    
    for doc_id, data in raw_results.items():
        if data["chunks"] and data["chunks"][0]["score"] > best_score:
            best_score = data["chunks"][0]["score"]
            best_doc_id = doc_id

    same_doc_threshold  = max(ABSOLUTE_FLOOR, best_score * SAME_DOC_RATIO)
    other_doc_threshold = max(ABSOLUTE_FLOOR, best_score * OTHER_DOC_RATIO)
    
    return best_score, best_doc_id, same_doc_threshold, other_doc_threshold


def filter_chunks_by_threshold(
    raw_results: Dict,
    best_doc_id: int,
    same_doc_threshold: float,
    other_doc_threshold: float
) -> Tuple[List[str], Dict, List[int]]:
    """
    Filter chunks by threshold and build context blocks.
    
    Returns:
        (context_blocks, chunk_map, passing_doc_ids)
    """
    context_blocks = []
    chunk_map = {}
    passing_doc_ids = []

    for doc_id, data in raw_results.items():
        doc_title = data["doc_title"]
        threshold = same_doc_threshold if doc_id == best_doc_id else other_doc_threshold
        passing_chunks = [c for c in data["chunks"] if c["score"] >= threshold]

        if not passing_chunks:
            continue

        passing_doc_ids.append(doc_id)

        block_lines = [f"[Source: {doc_title}]"]
        for c in passing_chunks:
            cid = f"DOC{doc_id}_CHUNK{c['chunk_index']}"
            block_lines.append(f"[CHUNK_ID: {cid}]\n{c['text']}")
            
            # Store full metadata in chunk_map
            chunk_map[cid] = {
                "doc_id": doc_id,
                "doc_title": doc_title,
                "cloudinary_url": data.get("cloudinary_url"),
                "page": c.get("start_page_num"),
                "section": c.get("section_title"),
                "snippet": c["text"][:150].strip()
            }

        context_blocks.append("\n\n".join(block_lines))
    
    return context_blocks, chunk_map, passing_doc_ids


# ============================================================================
# STEP 3: CONVERSATION CONTEXT BUILDING
# ============================================================================

def build_conversation_context(
    passing_doc_ids: List[int],
    doc_histories: Dict,
    document_ids: List[int]
) -> str:
    """
    Build conversation context for passing docs only.
    
    Returns:
        Formatted conversation context string
    """
    from app.models import MessageRole
    
    conversation_context = ""
    
    for doc_id in passing_doc_ids:
        if doc_id in doc_histories:
            doc_data = doc_histories[doc_id]
            
            conversation_context += f"\n[Conversation History - {doc_data['doc_title']}]:\n"
            
            # Add summary
            if doc_data.get('summary'):
                conversation_context += f"Summary of earlier conversation: {doc_data['summary']}\n\n"
            
            # Add last N messages
            if doc_data.get('last_n_messages'):
                conversation_context += "Recent exchanges:\n"
                for msg in doc_data['last_n_messages']:
                    role = "User" if msg.role == MessageRole.USER else "Assistant"
                    conversation_context += f"{role}: {msg.message}\n"
            
            conversation_context += "\n"
    
    return conversation_context


# ============================================================================
# STEP 4: LLM INVOCATION
# ============================================================================

def build_prompt(question: str, conversation_context: str, full_context: str, available_chunk_ids: List[str]) -> str:
    """Build the prompt for LLM."""
    return f"""You are answering a question using content retrieved from documents.
Each chunk is labeled with [CHUNK_ID: ...] and its source document.

{conversation_context}

Question: {question}

Retrieved Content:
{full_context}

Instructions:
1. Use the conversation history above to understand context and follow-up questions.
2. The summary shows what was discussed earlier about each document.
3. The recent exchanges show the immediate conversation flow.
4. Provide ONE unified answer using only the retrieved content below.
5. If sources contribute different points, integrate them naturally.
6. CONTRADICTION DETECTION: If documents conflict on the same point, explicitly note:
   "Note: Documents contradict each other — [Doc A] states X while [Doc B] states Y."
   Then recommend the safer option if possible.
7. If no contradiction, answer normally.
8. Do not make up information not in the content.
9. In "used_chunk_ids", list ONLY the CHUNK_IDs that directly contain the specific facts answering the question.
   Do NOT include chunks used only for background context or general topic framing.
   Example: if asked "Who is Babar Azam?" and one chunk says "PSL is a cricket league" and another says "Babar Azam is a top batsman", only include the second chunk.
   Available chunk IDs: {available_chunk_ids}"""


def invoke_llm_with_structured_output(
    question: str,
    conversation_context: str,
    context_blocks: List[str],
    chunk_map: Dict
) -> Dict:
    """
    Invoke LLM with structured output and return result.
    
    Returns:
        Dict with answer, has_contradiction, citations
    """
    from shared.llm import create_llm_provider
    from app.core.config import get_settings
    
    settings = get_settings()
    llm = create_llm_provider(
        llm_provider=settings.llm_provider,
        llm_model=settings.llm_model,
        google_api_key=settings.google_api_key,
        openai_api_key=settings.openai_api_key
    )

    # Try structured output first
    try:
        langchain_model = llm.get_langchain_model()
        structured_llm = langchain_model.with_structured_output(LLMDocQAOutput)
        
        full_context = "\n\n---\n\n".join(context_blocks)
        available_chunk_ids = list(chunk_map.keys())
        
        prompt = build_prompt(question, conversation_context, full_context, available_chunk_ids)
        
        # Invoke with structured output
        result: LLMDocQAOutput = structured_llm.invoke(prompt)
        
        answer = result.answer
        has_contradiction = result.has_contradiction
        used_chunk_ids = result.used_chunk_ids
        
        # Build final citations
        final_citations = []
        for cid in used_chunk_ids:
            if cid in chunk_map:
                final_citations.append(chunk_map[cid])
        
        return {
            "answer": answer,
            "has_contradiction": has_contradiction,
            "citations": final_citations
        }
        
    except Exception:
        return _fallback_to_generate_json(llm, question, context_blocks, chunk_map, conversation_context)


def _fallback_to_generate_json(llm, question: str, context_blocks: List[str], chunk_map: Dict, conversation_context: str = "") -> Dict:
    """Fallback to generate_json() if structured output fails."""
    full_context = "\n\n---\n\n".join(context_blocks)
    available_chunk_ids = list(chunk_map.keys())
    
    prompt = build_prompt(question, conversation_context, full_context, available_chunk_ids)
    prompt += "\n\nRespond with ONLY valid JSON:\n{\n  \"answer\": \"your full answer here\",\n  \"has_contradiction\": true or false,\n  \"used_chunk_ids\": [\"list only chunk IDs you actually used\"]\n}"
    
    result = llm.generate_json(prompt)
    answer = result.get("answer", "Could not generate an answer.")
    has_contradiction = result.get("has_contradiction", False)
    used_chunk_ids = result.get("used_chunk_ids", [])

    final_citations = []
    for cid in used_chunk_ids:
        if cid in chunk_map:
            final_citations.append(chunk_map[cid])

    return {
        "answer": answer,
        "has_contradiction": has_contradiction,
        "citations": final_citations
    }


# ============================================================================
# MAIN TOOL FACTORY
# ============================================================================

def make_doc_qa_tool_structured(chunk_db, document_ids: List[int], doc_histories: dict = None):
    """
    Create doc QA tool with structured output enforcement and history filtering.
    
    This version uses LangChain's with_structured_output() to guarantee
    the LLM returns data in the correct format (LLMDocQAOutput schema).
    
    After chunk filtering, only passes histories for documents with passing chunks.
    """
    if doc_histories is None:
        doc_histories = {}

    @tool(args_schema=DocQAToolArgs, return_direct=True)
    def doc_qa_tool(question: str) -> str:
        """Answer questions by searching across all selected documents.

        Use this tool for any specific question about document content such as:
        - "What is X?", "How does Y work?", "Explain Z"
        - "What are the requirements for...?", "Who is responsible for...?"
        - "What does the document say about...?"
        - Factual lookups, definitions, procedures, rules, or any content question
        - Multiple questions in one message — combine them into a single question string

        Do NOT use this tool when the user wants a summary, overview, table of
        contents, or section list — use list_document_sections_tool for those.

        IMPORTANT: Call this tool ONLY ONCE per turn, even if the user asks multiple questions.
        Combine all questions into one question string.

        CRITICAL: This tool is FINAL and COMPLETE. After calling this tool:
        - DO NOT call any other tool
        - DO NOT call list_document_sections_tool
        - DO NOT call generate_section_summary_tool
        - Return the output IMMEDIATELY without any additional processing
        
        The tool output is already a complete answer with citations. Your job is ONLY
        to return it exactly as-is. Do not try to improve, enhance, or supplement it.

        Returns a JSON string with keys: answer, has_contradiction, citations.
        IMPORTANT: Return the tool output EXACTLY as-is. Do not reformat or summarize it.
        """
        try:
            # Validate inputs
            if not document_ids:
                return json.dumps({
                    "answer": "No documents selected. Please select at least one document.",
                    "has_contradiction": False,
                    "citations": []
                })

            # Step 1: Retrieve chunks
            raw_results = retrieve_chunks_for_all_docs(chunk_db, document_ids, question)
            
            if not raw_results:
                return json.dumps({
                    "answer": "No relevant information could be retrieved from the selected documents.",
                    "has_contradiction": False,
                    "citations": []
                })

            # Step 2: Calculate thresholds and filter chunks
            best_score, best_doc_id, same_doc_threshold, other_doc_threshold = calculate_thresholds(raw_results)
            context_blocks, chunk_map, passing_doc_ids = filter_chunks_by_threshold(
                raw_results, best_doc_id, same_doc_threshold, other_doc_threshold
            )
            
            if not context_blocks:
                return json.dumps({
                    "answer": "The selected documents do not contain relevant information for this question.",
                    "has_contradiction": False,
                    "citations": []
                })

            # Step 3: Build conversation context for passing docs
            conversation_context = build_conversation_context(passing_doc_ids, doc_histories, document_ids)

            # Step 4: Invoke LLM
            result = invoke_llm_with_structured_output(question, conversation_context, context_blocks, chunk_map)
            
            # Prepare logging data
            try:
                from app.services.chat_logger import get_logger
                
                logger = get_logger()
                print(f"[TOOL] Logger instance: {logger}", file=sys.stderr)
                
                if logger:
                    print(f"[TOOL] Preparing logging data...", file=sys.stderr)
                    
                    # Prepare retrieved chunks for logging
                    retrieved_chunks = {}
                    for doc_id, data in raw_results.items():
                        chunks_with_meta = []
                        for chunk in data['chunks']:
                            chunks_with_meta.append({
                                'doc_title': data['doc_title'],
                                'score': chunk['score'],
                                'start_page_num': chunk.get('start_page_num'),
                                'section_title': chunk.get('section_title'),
                                'text': chunk['text']
                            })
                        retrieved_chunks[doc_id] = chunks_with_meta
                    
                    # Separate passing and dropped chunks
                    passing_chunks = {}
                    dropped_chunks = {}
                    
                    for doc_id, data in raw_results.items():
                        threshold = same_doc_threshold if doc_id == best_doc_id else other_doc_threshold
                        doc_passing = []
                        doc_dropped = []
                        
                        for chunk in data['chunks']:
                            chunk_with_meta = {
                                'doc_title': data['doc_title'],
                                'score': chunk['score'],
                                'start_page_num': chunk.get('start_page_num'),
                                'section_title': chunk.get('section_title'),
                                'text': chunk['text']
                            }
                            if chunk['score'] >= threshold:
                                doc_passing.append(chunk_with_meta)
                            else:
                                doc_dropped.append(chunk_with_meta)
                        
                        if doc_passing:
                            passing_chunks[doc_id] = doc_passing
                        if doc_dropped:
                            dropped_chunks[doc_id] = doc_dropped
                    
                    print(f"[TOOL] Calling logger.log_turn()...", file=sys.stderr)
                    
                    # Log the turn
                    logger.log_turn(
                        user_message=question,
                        active_doc_ids=document_ids,
                        retrieved_chunks=retrieved_chunks,
                        dropped_chunks=dropped_chunks,
                        passing_chunks=passing_chunks,
                        thresholds={
                            'best_score': best_score,
                            'best_doc_id': best_doc_id,
                            'same_doc_threshold': same_doc_threshold,
                            'other_doc_threshold': other_doc_threshold
                        },
                        doc_histories=doc_histories,
                        llm_answer=result['answer'],
                        citations=result['citations'],
                        has_contradiction=result['has_contradiction']
                    )
                    
                    print(f"[TOOL] Logging completed successfully", file=sys.stderr)
                else:
                    print(f"[TOOL] Logger is None - skipping logging", file=sys.stderr)
            except Exception as log_error:
                # Don't fail the request if logging fails
                print(f"[TOOL] Logging error: {log_error}", file=sys.stderr)
                import traceback
                traceback.print_exc(file=sys.stderr)
            
            return json.dumps(result)

        except Exception:
            import traceback
            traceback.print_exc(file=sys.stderr)
            return json.dumps({
                "answer": "Something went wrong while searching the documents. Please try again.",
                "has_contradiction": False,
                "citations": []
            })

    return doc_qa_tool
