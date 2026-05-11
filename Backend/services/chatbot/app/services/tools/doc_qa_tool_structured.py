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

# Import debug logger
from app.utils.debug_logger import debug_log
from typing import List, Dict, Tuple
import sys
import json

from .schemas import LLMDocQAOutput

ABSOLUTE_FLOOR   = 0.60   # Hard minimum cosine similarity for any chunk
SAME_DOC_RATIO   = 0.75   # Threshold ratio for the best-scoring document
OTHER_DOC_RATIO  = 0.85   # Stricter threshold ratio for all other documents

def _get_top_k() -> int:
    from app.core.config import get_settings
    return get_settings().max_chunks_per_doc


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
                top_k=_get_top_k()
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
                "section": c.get("section_title")
                # Note: snippets now come from LLM, not stored here
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
8. ANTI-HALLUCINATION (STRICTLY FOLLOW):
   - ONLY use information explicitly present in the retrieved content above.
   - Do NOT add facts, details, or explanations from your own training knowledge.
   - If the retrieved content does not contain enough information to answer the question, respond with:
     "The provided documents do not contain information about this topic."
   - If the content is only partially relevant, answer only the covered parts and state:
     "The documents do not contain information about [missing part]."
   - Do NOT infer, assume, or extrapolate beyond what is stated in the chunks.
9. CITATIONS: For each chunk you use, provide:
   - chunk_id: The CHUNK_ID (e.g., "DOC5_CHUNK2")
   - highlight_snippets: 2-3 EXACT text phrases (5-20 words each) from that chunk that directly answer the question
   
   Copy these phrases EXACTLY as they appear in the chunk. These will be highlighted in yellow on the PDF.
   Only cite chunks that directly contain facts answering the question.
   Do NOT cite chunks used only for background context.
   
   Available chunk IDs: {available_chunk_ids}

CITATION EXAMPLES:
- Question: "What is Aadil's CGPA?"
  Chunk: "Education: FAST University — BS Computer Science. Final Semester CGPA: 3.99 / 4.0"
  Good snippets: ["Final Semester CGPA: 3.99 / 4.0", "BS Computer Science"]
  Bad snippets: ["Education", "FAST University"] (too vague, doesn't answer question)

- Question: "What are the PSL teams?"
  Chunk: "The PSL features six teams: Karachi Kings, Lahore Qalandars, Multan Sultans, Peshawar Zalmi, Quetta Gladiators, and Islamabad United."
  Good snippets: ["six teams: Karachi Kings, Lahore Qalandars, Multan Sultans", "Peshawar Zalmi, Quetta Gladiators, and Islamabad United"]
  Bad snippets: ["Pakistan Super League"] (doesn't answer the question)

FORMATTING RULES:
- Use proper markdown formatting
- For numbered lists, add TWO line breaks after each item:
  1. First item
  
  2. Second item
  
  3. Third item
- For bullet lists, add ONE line break after each item
- Bold important terms using **term**
- Use proper paragraph spacing"""


def invoke_llm_with_structured_output(
    question: str,
    conversation_context: str,
    context_blocks: List[str],
    chunk_map: Dict
) -> Dict:
    """
    Invoke LLM with structured output and return result + token counts.

    Returns:
        Dict with answer, has_contradiction, citations, tokens_input, tokens_output
    """
    from shared.llm import create_llm_provider
    from shared.llm.utils import count_tokens
    from app.core.config import get_settings

    settings = get_settings()
    llm = create_llm_provider(
        llm_provider=settings.llm_provider,
        llm_model=settings.llm_model,
        google_api_key=settings.google_api_key,
        openai_api_key=settings.openai_api_key,
        max_output_tokens=settings.max_output_tokens
    )

    # Count user-variable input tokens: chunk text only (question counted in chat_service_v2)
    full_context = "\n\n---\n\n".join(context_blocks)
    tokens_input = count_tokens(full_context)

    try:
        langchain_model = llm.get_langchain_model()
        structured_llm = langchain_model.with_structured_output(LLMDocQAOutput)
        available_chunk_ids = list(chunk_map.keys())
        prompt = build_prompt(question, conversation_context, full_context, available_chunk_ids)
        result: LLMDocQAOutput = structured_llm.invoke(prompt)

        answer = result.answer
        has_contradiction = result.has_contradiction
        llm_citations = result.citations  # List[ChunkCitation]
        tokens_output = count_tokens(answer)

        # Build final citations by enriching LLM citations with chunk metadata
        final_citations = []
        for citation in llm_citations:
            chunk_id = citation.chunk_id
            if chunk_id in chunk_map:
                chunk_meta = chunk_map[chunk_id]
                final_citations.append({
                    "doc_id": chunk_meta["doc_id"],
                    "doc_title": chunk_meta["doc_title"],
                    "cloudinary_url": chunk_meta["cloudinary_url"],
                    "page": chunk_meta["page"],
                    "section": chunk_meta["section"],
                    "snippets": citation.highlight_snippets  # ✅ Array of snippets from LLM
                })
        
        # ✅ NEW: Include retrieved contexts (chunk texts) for RAGAS evaluation
        # Extract chunk texts from context_blocks (they contain the actual text)
        retrieved_contexts = []
        debug_log(f"[INVOKE_LLM] Starting extraction from {len(context_blocks)} context blocks", "INVOKE_LLM")
        for block_idx, block in enumerate(context_blocks):
            debug_log(f"[INVOKE_LLM] Block {block_idx}: length={len(block)}, preview='{block[:200]}'", "INVOKE_LLM")
            # Each block contains chunks with format: [CHUNK_ID: ...]\ntext
            # Split by CHUNK_ID markers and extract text
            chunks_in_block = block.split('[CHUNK_ID:')
            debug_log(f"[INVOKE_LLM] Block {block_idx}: split into {len(chunks_in_block)} parts", "INVOKE_LLM")
            for chunk_idx, chunk_part in enumerate(chunks_in_block[1:]):  # Skip first part (source header)
                # Extract text after the chunk ID line
                lines = chunk_part.split('\n', 1)
                debug_log(f"[INVOKE_LLM] Block {block_idx}, chunk {chunk_idx}: split into {len(lines)} lines", "INVOKE_LLM")
                if len(lines) > 1:
                    extracted_text = lines[1].strip()
                    retrieved_contexts.append(extracted_text)
                    debug_log(f"[INVOKE_LLM] Block {block_idx}, chunk {chunk_idx}: extracted {len(extracted_text)} chars: '{extracted_text[:100]}'", "INVOKE_LLM")
                else:
                    debug_log(f"[INVOKE_LLM] Block {block_idx}, chunk {chunk_idx}: SKIPPED (only {len(lines)} line)", "INVOKE_LLM")

        debug_log(f"[INVOKE_LLM] Extracted {len(retrieved_contexts)} contexts from {len(context_blocks)} blocks", "INVOKE_LLM")
        
        return {
            "answer": answer,
            "has_contradiction": has_contradiction,
            "citations": final_citations,
            "tokens_input": tokens_input,
            "tokens_output": tokens_output,
            "call_type": "doc_qa",
        }

    except Exception:
        return _fallback_to_generate_json(llm, question, context_blocks, chunk_map, conversation_context, tokens_input)


def _fallback_to_generate_json(llm, question: str, context_blocks: List[str], chunk_map: Dict, conversation_context: str = "", tokens_input: int = 0) -> Dict:
    """Fallback to generate_json() if structured output fails."""
    from shared.llm.utils import count_tokens
    full_context = "\n\n---\n\n".join(context_blocks)
    # tokens_input already has chunk text counted; don't re-count
    available_chunk_ids = list(chunk_map.keys())
    prompt = build_prompt(question, conversation_context, full_context, available_chunk_ids)
    prompt += "\n\nRespond with ONLY valid JSON:\n{\n  \"answer\": \"your full answer here\",\n  \"has_contradiction\": true or false,\n  \"citations\": [{\"chunk_id\": \"DOC5_CHUNK2\", \"highlight_snippets\": [\"exact phrase 1\", \"exact phrase 2\"]}]\n}"

    result = llm.generate_json(prompt)
    answer = result.get("answer", "Could not generate an answer.")
    has_contradiction = result.get("has_contradiction", False)
    llm_citations = result.get("citations", [])
    tokens_output = count_tokens(answer)

    # Build final citations
    final_citations = []
    for citation in llm_citations:
        chunk_id = citation.get("chunk_id")
        if chunk_id and chunk_id in chunk_map:
            chunk_meta = chunk_map[chunk_id]
            final_citations.append({
                "doc_id": chunk_meta["doc_id"],
                "doc_title": chunk_meta["doc_title"],
                "cloudinary_url": chunk_meta["cloudinary_url"],
                "page": chunk_meta["page"],
                "section": chunk_meta["section"],
                "snippets": citation.get("highlight_snippets", [])
            })
    
    # ✅ NEW: Include retrieved contexts (chunk texts) for RAGAS evaluation
    # Extract chunk texts from context_blocks (they contain the actual text)
    retrieved_contexts = []
    for block in context_blocks:
        # Each block contains chunks with format: [CHUNK_ID: ...]\ntext
        # Split by CHUNK_ID markers and extract text
        chunks_in_block = block.split('[CHUNK_ID:')
        for chunk_part in chunks_in_block[1:]:  # Skip first part (source header)
            # Extract text after the chunk ID line
            lines = chunk_part.split('\n', 1)
            if len(lines) > 1:
                retrieved_contexts.append(lines[1].strip())

    debug_log(f"Extracted {len(retrieved_contexts)} contexts from {len(context_blocks)} blocks", "FALLBACK")
    
    return {
        "answer": answer,
        "has_contradiction": has_contradiction,
        "citations": final_citations,
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
        "call_type": "doc_qa",
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

    @tool(args_schema=DocQAToolArgs)
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

            # ── DEBUG: print all chunks with scores and pass/fail status ──
            debug_log(f"\n[CHUNKS] Question: '{question}'", "INVOKE_LLM")
            debug_log(f"Thresholds — best_score={best_score:.4f}, best_doc_id={best_doc_id}, same_doc_thresh={same_doc_threshold:.4f}, other_doc_thresh={other_doc_threshold:.4f}", "CHUNKS")
            total_pass = 0
            total_drop = 0
            for doc_id, data in raw_results.items():
                thresh = same_doc_threshold if doc_id == best_doc_id else other_doc_threshold
                doc_pass = sum(1 for c in data["chunks"] if c["score"] >= thresh)
                doc_drop = len(data["chunks"]) - doc_pass
                total_pass += doc_pass
                total_drop += doc_drop
                debug_log(f"Doc {doc_id} '{data['doc_title']}' (thresh={thresh:.4f}) — {doc_pass} pass, {doc_drop} drop:", "CHUNKS")
                for c in data["chunks"]:
                    status = "✓ PASS" if c["score"] >= thresh else "✗ DROP"
                    debug_log(f"  [{status}] score={c['score']:.4f} | page={c.get('start_page_num')} | sec='{c.get('section_title','')[:40]}' | text='{c['text'][:80].strip()}'", "CHUNKS")
            debug_log(f"TOTAL: {total_pass} passed, {total_drop} dropped | passing_docs={passing_doc_ids} | context_blocks={len(context_blocks)}", "CHUNKS")
            # ── END DEBUG ──

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
                debug_log(f"Logger instance: {logger}", "TOOL")
                
                if logger:
                    debug_log(f"Preparing logging data...", "TOOL")
                    
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
                    
                    debug_log(f"Calling logger.log_turn()...", "TOOL")
                    
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
                    
                    debug_log(f"Logging completed successfully", "TOOL")
                else:
                    debug_log(f"Logger is None - skipping logging", "TOOL")
            except Exception as log_error:
                # Don't fail the request if logging fails
                debug_log(f"Logging error: {log_error}", "TOOL")
                import traceback
                traceback.print_exc(file=sys.stderr)
            
            return json.dumps(result)

        except Exception:
            import traceback
            traceback.print_exc(file=sys.stderr)
            return json.dumps({
                "answer": "Something went wrong while searching the documents. Please try again.",
                "has_contradiction": False,
                "citations": [],
                "tokens_input": 0,
                "tokens_output": 0,
                "call_type": "doc_qa",
            })

    return doc_qa_tool
