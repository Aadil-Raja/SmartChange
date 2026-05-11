# app/services/tools/doc_qa_multi/tool.py
"""
Multi-document QA tool factory - orchestrates decomposition, retrieval, and merging.
"""
import sys
import json
import uuid
from langchain_core.tools import tool
from typing import Dict, List
from pydantic import BaseModel, Field

# Import debug logger
from app.utils.debug_logger import debug_log

# Import token tracker
from ..token_tracker import add_tokens, get_tokens, cleanup

from .decomposer import decompose_question
from .retriever import retrieve_and_answer_subquestions
from .merger import merge_answers
from app.core.config import get_settings


# ✅ Define return schema for the tool
class DocQAToolOutput(BaseModel):
    """Output schema for doc_qa_multi_tool"""
    answer: str = Field(description="The answer to the user's question")
    has_contradiction: bool = Field(description="Whether contradictions were found")
    citations: List[dict] = Field(description="List of citations")
    tokens_input: int = Field(description="Total input tokens consumed")
    tokens_output: int = Field(description="Total output tokens consumed")
    call_type: str = Field(description="Type of call (doc_qa, list_sections, etc.)")
    request_id: str = Field(description="Unique request identifier for token tracking")



def _prefetch_section_names(chunk_db, document_ids: List[int]) -> Dict[int, List[str]]:
    """
    Pre-fetch section names for all documents in parallel.
    
    Args:
        chunk_db: Database session
        document_ids: List of document IDs
        
    Returns:
        Dict mapping doc_id to list of section names
    """
    from concurrent.futures import ThreadPoolExecutor
    from shared.models import DocumentSection
    
    def get_sections(doc_id):
        try:
            sections = chunk_db.query(DocumentSection.section_title).filter(
                DocumentSection.document_id == doc_id
            ).order_by(DocumentSection.start_chunk_index).all()
            return doc_id, [s[0] for s in sections if s[0]]
        except Exception as e:
            debug_log(f"Error getting sections for doc {doc_id}: {e}", "PREFETCH")
            return doc_id, []
    
    with ThreadPoolExecutor(max_workers=len(document_ids)) as executor:
        futures = [executor.submit(get_sections, doc_id) for doc_id in document_ids]
        results = [future.result() for future in futures]
    
    return dict(results)


def make_doc_qa_multi_tool(chunk_db, document_ids: List[int], doc_histories: Dict, section_names_map: Dict[int, List[str]] = None, use_deep_reranker: bool = False):
    """
    Create a multi-document QA tool with intelligent question decomposition.
    
    This tool:
    1. Analyzes if the question spans multiple documents
    2. If yes and confident, decomposes into sub-questions
    3. Retrieves answers in parallel
    4. Merges into one coherent response
    5. Falls back to single-doc tool if not needed or on error
    
    Args:
        chunk_db: Database session for chunk retrieval (management DB)
        document_ids: List of active document IDs
        doc_histories: Dict mapping doc_id to {doc_title, summary, last_n_messages}
        section_names_map: Optional pre-fetched section names (for optimization)
        
    Returns:
        LangChain Tool that can be used by the agent
    """
    settings = get_settings()
    
    @tool
    def doc_qa_multi_tool(questions: List[str]) -> DocQAToolOutput:
        
        """
        Answer questions about document content. Handles single and multi-part questions automatically.
        
        CRITICAL INSTRUCTIONS:
        - ALWAYS pass the COMPLETE user question as a SINGLE string in a single-item list.
        - NEVER break the question into multiple items — the tool handles decomposition internally.
        - Call this tool EXACTLY ONCE per user message, no matter how many sub-questions exist.
        
        EXAMPLES:
        
        User: "What is Aadil's education background?"
        ✅ CORRECT: doc_qa_multi_tool(questions=["What is Aadil's education background?"])
        
        User: "What are Aadil's projects and what are the PSL teams?"
        ✅ CORRECT: doc_qa_multi_tool(questions=["What are Aadil's projects and what are the PSL teams?"])
        ❌ WRONG: doc_qa_multi_tool(questions=["What are Aadil's projects?", "What are the PSL teams?"])
        ❌ WRONG: Call the tool twice — once for each sub-question
        
        User: "Tell me about Aadil's skills, the PSL format, and Harry Potter books"
        ✅ CORRECT: doc_qa_multi_tool(questions=["Tell me about Aadil's skills, the PSL format, and Harry Potter books"])
        ❌ WRONG: doc_qa_multi_tool(questions=["What are Aadil's skills?", "What is the PSL format?", "What are the Harry Potter books?"])
        
        After this tool returns, STOP. Do not call any other tool. Return the output as-is.
        
        Returns:
            Dict with answer, has_contradiction, citations, tokens_input, tokens_output
        """
        try:
            # ✅ Generate unique request ID for token tracking
            request_id = str(uuid.uuid4())
            debug_log(f"[MULTI-DOC TOOL] Request ID: {request_id}", "MULTI-DOC")
            
            # Combine questions into single string for processing
            if len(questions) == 1:
                question = questions[0]
                debug_log(f"\n[MULTI-DOC TOOL] Processing single question: '{question}'", "MULTI-DOC")
            else:
                question = " ".join(questions)
                debug_log(f"\n[MULTI-DOC TOOL] Processing {len(questions)} questions combined: '{question}'", "MULTI-DOC")
            
            debug_log(f"[MULTI-DOC TOOL] Active documents: {document_ids}", "MULTI-DOC")
            
            # ✅ NEW: Log user turn at the start
            try:
                from app.services.chat_logger import get_logger
                logger = get_logger()
                if logger:
                    logger.log_user_turn(question, document_ids)
            except Exception as log_err:
                debug_log(f"[MULTI-DOC TOOL] Failed to log user turn: {log_err}", "MULTI-DOC")
            
            # Optimization: Skip decomposition if only 1 document
            if len(document_ids) == 1:
                debug_log(f"[MULTI-DOC TOOL] Only 1 document active, skipping decomposition", "MULTI-DOC")
                return _fallback_to_single_doc(question, chunk_db, document_ids, doc_histories, use_deep_reranker, keywords=[])
            
            # Import LLM provider
            from shared.llm import create_llm_provider
            llm = create_llm_provider(
                llm_provider=settings.llm_provider,
                llm_model=settings.llm_model,
                google_api_key=settings.google_api_key,
                openai_api_key=settings.openai_api_key,
                max_output_tokens=settings.max_output_tokens
            )
            
            # ✅ OPTIMIZATION: Use pre-fetched sections if available, otherwise fetch now
            # Use nonlocal to access the closure variable from outer scope
            nonlocal section_names_map
            if section_names_map:
                debug_log(f"[MULTI-DOC TOOL] Using pre-fetched section names", "MULTI-DOC")
            else:
                debug_log(f"[MULTI-DOC TOOL] Pre-fetching section names...", "MULTI-DOC")
                section_names_map = _prefetch_section_names(chunk_db, document_ids)
            
            # Step 1: Decompose the question (with pre-fetched sections)
            debug_log(f"[MULTI-DOC TOOL] Step 1: Decomposing question...", "MULTI-DOC")
            decomposed = decompose_question(
                question=question,
                document_ids=document_ids,
                doc_histories=doc_histories,
                llm=llm,
                management_db=chunk_db,  # Pass management DB for section retrieval
                section_names_map=section_names_map,  # ✅ NEW: Pass pre-fetched sections
                request_id=request_id  # ✅ Pass request_id for token tracking
            )
            
            # Step 2: Confidence gate - fall back to single-doc if needed
            if not decomposed.is_cross_doc or decomposed.confidence < 0.7 or not decomposed.sub_questions:
                debug_log(f"[MULTI-DOC TOOL] Falling back to single-doc path (is_cross_doc={decomposed.is_cross_doc}, confidence={decomposed.confidence})", "MULTI-DOC")
                # Extract keywords from first sub-question if available
                keywords = decomposed.sub_questions[0].keywords if decomposed.sub_questions and len(decomposed.sub_questions) > 0 else []
                
                result = _fallback_to_single_doc(
                    question, chunk_db, document_ids, doc_histories, use_deep_reranker, keywords,
                    request_id=request_id  # ✅ Pass request_id
                )
                
                # ✅ DON'T cleanup here - let agent do it
                # cleanup(request_id)
                return result
            
            debug_log(f"[MULTI-DOC TOOL] Using multi-doc path with {len(decomposed.sub_questions)} sub-questions", "MULTI-DOC")
            
            # Step 3: Retrieve and answer sub-questions in parallel
            debug_log(f"[MULTI-DOC TOOL] Step 2: Retrieving answers in parallel...", "MULTI-DOC")
            sub_answers = retrieve_and_answer_subquestions(
                sub_questions=decomposed.sub_questions,
                chunk_db=chunk_db,
                doc_histories=doc_histories,
                settings=settings,
                all_active_doc_ids=document_ids,  # ✅ NEW: Pass all active docs for fallback retrieval
                use_deep_reranker=use_deep_reranker,  # NEW: Pass deep flag
                request_id=request_id  # ✅ Pass request_id for token tracking
            )
            
            # Step 4: Merge answers
            debug_log(f"[MULTI-DOC TOOL] Step 3: Merging answers...", "MULTI-DOC")
            merged = merge_answers(
                sub_answers=sub_answers,
                original_question=question,
                llm=llm,
                request_id=request_id  # ✅ Pass request_id for token tracking
            )
            
            # ✅ NEW: Log merged answer
            try:
                from app.services.chat_logger import get_logger
                logger = get_logger()
                if logger:
                    logger.log_merged_answer(merged.answer, merged.citations)
            except Exception as log_err:
                debug_log(f"[MULTI-DOC TOOL] Failed to log merged answer: {log_err}", "MULTI-DOC")
            
            # Step 5: Log the multi-doc flow (if logger is available) - OLD LOGGING, KEEP FOR NOW
            try:
                _log_multi_doc_flow(
                    question=question,
                    document_ids=document_ids,
                    decomposed=decomposed,
                    sub_answers=sub_answers,
                    merged=merged,
                    doc_histories=doc_histories
                )
            except Exception as log_error:
                debug_log(f"[MULTI-DOC TOOL] Logging error: {log_error}", "MULTI-DOC")
            
            # Step 6: Return dict in same format as single-doc tool (NOT JSON string)
            # ✅ Get tokens from global tracker
            tracked_tokens = get_tokens(request_id)
            
            result = {
                "answer": merged.answer,
                "has_contradiction": merged.has_contradiction,
                "citations": merged.citations,
                "tokens_input": tracked_tokens['input'],
                "tokens_output": tracked_tokens['output'],
                "call_type": "doc_qa",
                "request_id": request_id,  # ✅ Keep for belt-and-suspenders
            }
            
            # ✅ NEW: Store metadata in thread-local registry BEFORE LLM can corrupt it
            import threading
            tid = threading.get_ident()
            print(f"[TOOL] Thread ID: {tid}, storing metadata...", file=sys.stderr)
            
            from app.services.agent_service_v2 import _store_tool_metadata
            _store_tool_metadata(
                request_id=request_id,
                tokens_input=tracked_tokens['input'],
                tokens_output=tracked_tokens['output'],
                call_type="doc_qa",
                citations=merged.citations,
                has_contradiction=merged.has_contradiction
            )
            
            print(f"[TOOL] Metadata stored for thread {tid}", file=sys.stderr)
            
            # ✅ Print final summary
            print(f"\n{'='*80}", file=sys.stderr)
            print(f"✅ MULTI-DOC TOOL COMPLETE", file=sys.stderr)
            print(f"{'='*80}", file=sys.stderr)
            print(f"Sub-questions processed: {len(sub_answers)}", file=sys.stderr)
            print(f"Citations generated:     {len(merged.citations)}", file=sys.stderr)
            print(f"{'-'*80}", file=sys.stderr)
            print(f"TOTAL INPUT TOKENS:      {tracked_tokens['input']:>6} tokens (from tracker)", file=sys.stderr)
            print(f"TOTAL OUTPUT TOKENS:     {tracked_tokens['output']:>6} tokens (from tracker)", file=sys.stderr)
            print(f"GRAND TOTAL:             {tracked_tokens['input'] + tracked_tokens['output']:>6} tokens", file=sys.stderr)
            print(f"Request ID:              {request_id}", file=sys.stderr)
            print(f"{'='*80}\n", file=sys.stderr)
            
            debug_log(f"[MULTI-DOC TOOL] Complete! Returning merged answer with {len(merged.citations)} citations", "MULTI-DOC")
            
            # ✅ Safe to cleanup tracker now — values are in thread-local registry
            cleanup(request_id)
            
            return result
            
        except Exception as e:
            debug_log(f"[MULTI-DOC TOOL] Error in multi-doc flow: {e}, falling back to single-doc", "MULTI-DOC")
            import traceback
            traceback.print_exc(file=sys.stderr)
            
            # Fall back to single-doc tool on any error
            result = _fallback_to_single_doc(question, chunk_db, document_ids, doc_histories, use_deep_reranker, keywords=[], request_id=request_id)
            
            # ✅ DON'T cleanup here - let agent do it
            # cleanup(request_id)
            return result
    
    return doc_qa_multi_tool


def _fallback_to_single_doc(
    question: str, 
    chunk_db, 
    document_ids: List[int], 
    doc_histories: Dict, 
    use_deep_reranker: bool = False,
    keywords: List[str] = None,  # NEW: Accept keywords
    request_id: str = None  # ✅ NEW: Request ID for token tracking
):
    """
    Fall back to the existing single-doc QA tool.
    
    This is called when:
    - Question doesn't span multiple documents
    - Confidence is too low
    - Any error occurs in the multi-doc flow
    
    Args:
        use_deep_reranker: If True, uses jina-reranker-v3 (slower, more accurate)
    
    Returns:
        Dict with answer, has_contradiction, citations, tokens_input, tokens_output
    """
    try:
        debug_log(f"[MULTI-DOC TOOL] Executing single-doc fallback", "MULTI-DOC")
        debug_log(f"[MULTI-DOC TOOL] Keywords for fallback: {keywords}", "MULTI-DOC")
        
        # Import and use hybrid retrieval for single-doc fallback
        from ..hybrid_retrieval import retrieve_chunks_for_all_docs_hybrid
        from ..doc_qa_tool_structured import (
            calculate_thresholds,
            filter_chunks_by_threshold,
            build_conversation_context,
            invoke_llm_with_structured_output
        )
        
        # Use hybrid retrieval with deep reranker flag and keywords
        raw_results = retrieve_chunks_for_all_docs_hybrid(
            chunk_db=chunk_db,
            document_ids=document_ids,
            question=question,
            use_deep_reranker=use_deep_reranker,
            keywords=keywords  # NEW: Pass keywords
        )
        
        if not raw_results:
            return {
                "answer": "I couldn't find relevant information to answer your question.",
                "has_contradiction": False,
                "citations": [],
                "tokens_input": 0,
                "tokens_output": 0,
                "call_type": "doc_qa",
            }
        
        # ✅ NEW: Check if results are from reranker (have rerank_score)
        # If reranked, skip threshold filtering since reranker already scored them
        has_rerank_scores = False
        for doc_data in raw_results.values():
            if doc_data["chunks"] and "rerank_score" in doc_data["chunks"][0]:
                has_rerank_scores = True
                break
        
        if has_rerank_scores:
            # Reranked results - skip threshold filtering, use chunks as-is
            debug_log(f"Using reranked results, skipping threshold filtering", "FALLBACK")
            
            context_blocks = []
            chunk_map = {}
            passing_doc_ids = []
            
            for doc_id, data in raw_results.items():
                if not data["chunks"]:
                    continue
                
                passing_doc_ids.append(doc_id)
                doc_title = data["doc_title"]
                
                block_lines = [f"[Source: {doc_title}]"]
                for c in data["chunks"]:
                    cid = f"DOC{doc_id}_CHUNK{c['chunk_index']}"
                    block_lines.append(f"[CHUNK_ID: {cid}]\n{c['text']}")
                    
                    chunk_map[cid] = {
                        "doc_id": doc_id,
                        "doc_title": doc_title,
                        "cloudinary_url": data.get("cloudinary_url"),
                        "page": c.get("start_page_num"),
                        "section": c.get("section_title"),
                        "snippet": c["text"][:150].strip()
                    }
                
                context_blocks.append("\n".join(block_lines))
            
            debug_log(f"Using {len(context_blocks)} context blocks from {len(passing_doc_ids)} docs", "FALLBACK")
            
        else:
            # Not reranked - use traditional threshold filtering
            debug_log(f"Using threshold filtering (no rerank scores found)", "FALLBACK")
            
            # Calculate thresholds
            best_score, best_doc_id, same_doc_threshold, other_doc_threshold = calculate_thresholds(raw_results)
            
            # ✅ Log threshold calculation
            debug_log(f"Threshold calculation:", "FALLBACK")
            debug_log(f"  Best score: {best_score:.4f} from doc {best_doc_id}", "FALLBACK")
            debug_log(f"  Same doc threshold: {same_doc_threshold:.4f}", "FALLBACK")
            debug_log(f"  Other doc threshold: {other_doc_threshold:.4f}", "FALLBACK")
            
            # Filter chunks by threshold
            context_blocks, chunk_map, passing_doc_ids = filter_chunks_by_threshold(
                raw_results=raw_results,
                best_doc_id=best_doc_id,
                same_doc_threshold=same_doc_threshold,
                other_doc_threshold=other_doc_threshold
            )
            
            # ✅ Log filtering results
            debug_log(f"After threshold filtering:", "FALLBACK")
            debug_log(f"  Passing docs: {passing_doc_ids}", "FALLBACK")
            debug_log(f"  Context blocks: {len(context_blocks)}", "FALLBACK")
            debug_log(f"  Chunks in map: {len(chunk_map)}", "FALLBACK")
        
        if not context_blocks:
            debug_log(f"❌ NO CHUNKS AVAILABLE - returning empty answer", "FALLBACK")
            return {
                "answer": "I couldn't find relevant information to answer your question.",
                "has_contradiction": False,
                "citations": [],
                "tokens_input": 0,
                "tokens_output": 0,
                "call_type": "doc_qa",
            }
        
        # Build conversation context
        conversation_context = build_conversation_context(
            passing_doc_ids=passing_doc_ids,
            doc_histories=doc_histories,
            document_ids=document_ids
        )
        
        # Invoke LLM with structured output
        result = invoke_llm_with_structured_output(
            question=question,
            conversation_context=conversation_context,
            context_blocks=context_blocks,
            chunk_map=chunk_map
        )
        
        # ✅ Get tokens from tracker (includes decomposer tokens already added)
        if request_id:
            tracked_tokens = get_tokens(request_id)
            # Only use tracker values if they're non-zero; otherwise keep what invoke_llm already set
            if tracked_tokens['input'] > 0 or tracked_tokens['output'] > 0:
                result["tokens_input"] = tracked_tokens['input']
                result["tokens_output"] = tracked_tokens['output']
            result["request_id"] = request_id
            
            # ✅ NEW: Store metadata in thread-local registry
            import threading
            tid = threading.get_ident()
            print(f"[FALLBACK] Thread ID: {tid}, storing metadata...", file=sys.stderr)
            
            from app.services.agent_service_v2 import _store_tool_metadata
            _store_tool_metadata(
                request_id=request_id,
                tokens_input=result["tokens_input"],
                tokens_output=result["tokens_output"],
                call_type=result.get("call_type", "doc_qa"),
                citations=result.get("citations", []),
                has_contradiction=result.get("has_contradiction", False)
            )
            
            print(f"[FALLBACK] Metadata stored for thread {tid}", file=sys.stderr)
            
            # ✅ Print fallback summary
            print(f"\n{'='*80}", file=sys.stderr)
            print(f"✅ SINGLE-DOC FALLBACK COMPLETE", file=sys.stderr)
            print(f"{'='*80}", file=sys.stderr)
            print(f"TOTAL INPUT:        {result['tokens_input']:>6} tokens", file=sys.stderr)
            print(f"TOTAL OUTPUT:       {result['tokens_output']:>6} tokens", file=sys.stderr)
            print(f"GRAND TOTAL:        {result['tokens_input'] + result['tokens_output']:>6} tokens", file=sys.stderr)
            print(f"Request ID:         {request_id}", file=sys.stderr)
            print(f"{'='*80}\n", file=sys.stderr)
            
            # ✅ Safe to cleanup tracker now
            cleanup(request_id)
        else:
            # No request_id (shouldn't happen, but fallback to result tokens)
            print(f"[FALLBACK] Warning: No request_id provided", file=sys.stderr)
        
        # ✅ NEW: Log the fallback path
        try:
            _log_fallback_flow(
                question=question,
                document_ids=document_ids,
                raw_results=raw_results,
                passing_doc_ids=passing_doc_ids,
                chunk_map=chunk_map,
                result=result,
                doc_histories=doc_histories,
                has_rerank_scores=has_rerank_scores
            )
        except Exception as log_error:
            debug_log(f"Logging error: {log_error}", "FALLBACK")
        
        debug_log(f"[MULTI-DOC TOOL] Single-doc fallback complete", "MULTI-DOC")
        return result
        
    except Exception as e:
        debug_log(f"[MULTI-DOC TOOL] Error in single-doc fallback: {e}", "MULTI-DOC")
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        # Last resort: return error message in expected format
        return {
            "answer": "I apologize, but I encountered an error while processing your question. Please try rephrasing or ask about one topic at a time.",
            "has_contradiction": False,
            "citations": [],
            "tokens_input": 0,
            "tokens_output": 0,
            "call_type": "doc_qa",
        }


def _log_multi_doc_flow(
    question: str,
    document_ids: List[int],
    decomposed,
    sub_answers: List,
    merged,
    doc_histories: Dict
):
    """
    Log the multi-doc flow to the chat logger.
    
    This creates a detailed log entry showing:
    - Decomposition results
    - Each sub-question and its answer
    - Merged final answer
    """
    try:
        from app.services.chat_logger import get_logger
        from app.utils.debug_logger import is_file_logging_enabled
        
        if not is_file_logging_enabled():
            return  # Skip file logging if disabled
        
        logger = get_logger()
        if not logger:
            debug_log(f"[MULTI-DOC TOOL] No logger available, skipping logging", "MULTI-DOC")
            return
        
        debug_log(f"[MULTI-DOC TOOL] Logging multi-doc flow to chathead log", "MULTI-DOC")
        
        # Create a custom log entry for multi-doc flow
        with open(logger.log_file, 'a', encoding='utf-8') as f:
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            f.write("\n" + "="*100 + "\n")
            f.write(f"MULTI-DOC QA FLOW LOGGED AT: {timestamp}\n")
            f.write("="*100 + "\n\n")
            
            # User question
            f.write("┌─ USER QUESTION\n")
            f.write(f"│ {question}\n")
            f.write(f"└─ Active Documents: {document_ids}\n\n")
            
            # Decomposition results
            f.write("┌─ DECOMPOSITION ANALYSIS\n")
            f.write(f"│ Is Cross-Doc: {decomposed.is_cross_doc}\n")
            f.write(f"│ Confidence: {decomposed.confidence:.2f}\n")
            f.write(f"│ Sub-Questions: {len(decomposed.sub_questions)}\n")
            for i, sq in enumerate(decomposed.sub_questions, 1):
                f.write(f"│   {i}. \"{sq.question}\" → Docs {sq.doc_ids}\n")
            f.write("└─\n\n")
            
            # Sub-answers
            f.write("┌─ SUB-ANSWERS (Parallel Retrieval)\n")
            for i, sa in enumerate(sub_answers, 1):
                f.write(f"│\n│ ╔══════════════════════════════════════════════════════════════════════════════\n")
                f.write(f"│ ║ Sub-Question {i}: {sa.question}\n")
                f.write(f"│ ╚══════════════════════════════════════════════════════════════════════════════\n")
                f.write(f"│   Documents: {sa.doc_ids}\n")
                
                if sa.failed:
                    f.write(f"│   ❌ FAILED\n")
                    f.write(f"│   Error: {sa.error_note}\n")
                else:
                    f.write(f"│   ✅ SUCCESS\n")
                    f.write(f"│   Answer: {sa.answer[:200]}{'...' if len(sa.answer) > 200 else ''}\n")
                    f.write(f"│   Citations: {len(sa.citations)}\n")
                    f.write(f"│   Has Contradiction: {sa.has_contradiction}\n")
                    f.write(f"│   Tokens: {sa.tokens_input} input, {sa.tokens_output} output\n")
                f.write(f"│\n")
            f.write("└─\n\n")
            
            # Merged answer
            f.write("┌─ MERGED ANSWER\n")
            f.write(f"│ Has Contradiction: {merged.has_contradiction}\n")
            f.write(f"│ Total Citations: {len(merged.citations)}\n")
            f.write(f"│ Total Tokens: {merged.tokens_input} input, {merged.tokens_output} output\n")
            f.write(f"│\n│ Answer:\n")
            for line in merged.answer.split('\n'):
                f.write(f"│ {line}\n")
            f.write("└─\n\n")
            
            # Citations
            if merged.citations:
                f.write("┌─ CITATIONS (Deduplicated)\n")
                for i, citation in enumerate(merged.citations, 1):
                    f.write(f"│ {i}. Doc {citation.get('doc_id')}: {citation.get('doc_title', 'Unknown')}\n")
                    f.write(f"│    Page: {citation.get('page', '?')} | Section: {citation.get('section', 'Unknown')}\n")
                    f.write(f"│    Snippet: {citation.get('snippet', '')[:100]}...\n")
                f.write("└─\n\n")
            
            # Document histories context
            f.write("┌─ DOCUMENT HISTORIES (Context Provided)\n")
            for doc_id in document_ids:
                if doc_id in doc_histories:
                    history = doc_histories[doc_id]
                    f.write(f"│\n│ Document {doc_id}: {history.get('doc_title', 'Unknown')}\n")
                    
                    if history.get('summary'):
                        f.write(f"│   Summary: {history['summary'][:150]}...\n")
                    
                    messages = history.get('last_n_messages', [])
                    if messages:
                        f.write(f"│   Recent Messages: {len(messages)}\n")
            f.write("└─\n\n")
            
            f.write("="*100 + "\n\n")
            
            # Explicit flush
            f.flush()
            
        debug_log(f"[MULTI-DOC TOOL] Successfully logged multi-doc flow", "MULTI-DOC")
        
    except Exception as e:
        debug_log(f"[MULTI-DOC TOOL] Error logging multi-doc flow: {e}", "MULTI-DOC")
        import traceback
        traceback.print_exc(file=sys.stderr)


def _log_fallback_flow(
    question: str,
    document_ids: List[int],
    raw_results: Dict,
    passing_doc_ids: List[int],
    chunk_map: Dict,
    result: Dict,
    doc_histories: Dict,
    has_rerank_scores: bool
):
    """
    Log the single-doc fallback flow to the chat logger.
    
    This creates a log entry for questions that don't require decomposition.
    """
    try:
        from app.services.chat_logger import get_logger
        from app.utils.debug_logger import is_file_logging_enabled
        
        if not is_file_logging_enabled():
            return  # Skip file logging if disabled
        
        logger = get_logger()
        if not logger:
            debug_log(f"No logger available, skipping logging", "FALLBACK")
            return
        
        debug_log(f"Logging fallback flow to chathead log", "FALLBACK")
        
        with open(logger.log_file, 'a', encoding='utf-8') as f:
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            f.write("\n" + "="*100 + "\n")
            f.write(f"SINGLE-DOC QA FLOW (FALLBACK) LOGGED AT: {timestamp}\n")
            f.write("="*100 + "\n\n")
            
            # User question
            f.write("┌─ USER QUESTION\n")
            f.write(f"│ {question}\n")
            f.write(f"└─ Active Documents: {document_ids}\n\n")
            
            # Reason for fallback
            f.write("┌─ FLOW DECISION\n")
            f.write(f"│ Path: Single-Doc Fallback\n")
            f.write(f"│ Reason: Question does not span multiple documents OR confidence too low\n")
            f.write(f"│ Retrieval Method: {'Hybrid (Dense + Sparse + Reranking)' if has_rerank_scores else 'Dense Only'}\n")
            f.write("└─\n\n")
            
            # Retrieved chunks breakdown
            f.write("┌─ HYBRID RETRIEVAL RESULTS\n")
            for doc_id, data in raw_results.items():
                f.write(f"│\n│ Document {doc_id}: {data['doc_title']}\n")
                f.write(f"│ Retrieved {len(data['chunks'])} chunks\n")
                
                for i, chunk in enumerate(data['chunks'][:5], 1):  # Show top 5
                    f.write(f"│   {i}. ")
                    if has_rerank_scores and 'rerank_score' in chunk:
                        f.write(f"Rerank: {chunk['rerank_score']:.4f} | ")
                        f.write(f"Dense: {chunk.get('dense_score', 0):.4f} | ")
                        f.write(f"Sparse: {chunk.get('sparse_score', 0):.4f} | ")
                    else:
                        f.write(f"Score: {chunk['score']:.4f} | ")
                    f.write(f"Page: {chunk.get('start_page_num', '?')}\n")
                    f.write(f"│      Section: {chunk.get('section_title', 'Unknown')[:60]}\n")
                    f.write(f"│      Preview: {chunk['text'][:100].replace(chr(10), ' ')}...\n")
                
                if len(data['chunks']) > 5:
                    f.write(f"│   ... and {len(data['chunks']) - 5} more chunks\n")
            f.write("└─\n\n")
            
            # Passing documents
            f.write("┌─ DOCUMENTS USED IN ANSWER\n")
            f.write(f"│ Passing Documents: {passing_doc_ids}\n")
            f.write(f"│ Total Chunks Used: {len(chunk_map)}\n")
            f.write("└─\n\n")
            
            # Answer
            f.write("┌─ ANSWER\n")
            f.write(f"│ Has Contradiction: {result.get('has_contradiction', False)}\n")
            f.write(f"│ Citations: {len(result.get('citations', []))}\n")
            f.write(f"│ Tokens: {result.get('tokens_input', 0)} input, {result.get('tokens_output', 0)} output\n")
            f.write(f"│\n│ Answer:\n")
            for line in result.get('answer', '').split('\n'):
                f.write(f"│ {line}\n")
            f.write("└─\n\n")
            
            # Citations
            citations = result.get('citations', [])
            if citations:
                f.write("┌─ CITATIONS\n")
                for i, citation in enumerate(citations, 1):
                    f.write(f"│ {i}. Doc {citation.get('doc_id')}: {citation.get('doc_title', 'Unknown')}\n")
                    f.write(f"│    Page: {citation.get('page', '?')} | Section: {citation.get('section', 'Unknown')}\n")
                    f.write(f"│    Snippet: {citation.get('snippet', '')[:100]}...\n")
                f.write("└─\n\n")
            
            # Document histories
            f.write("┌─ DOCUMENT HISTORIES (Context Provided)\n")
            for doc_id in document_ids:
                if doc_id in doc_histories:
                    history = doc_histories[doc_id]
                    f.write(f"│\n│ Document {doc_id}: {history.get('doc_title', 'Unknown')}\n")
                    
                    if history.get('summary'):
                        f.write(f"│   Summary: {history['summary'][:150]}...\n")
                    
                    messages = history.get('last_n_messages', [])
                    if messages:
                        f.write(f"│   Recent Messages: {len(messages)}\n")
            f.write("└─\n\n")
            
            f.write("="*100 + "\n\n")
            
            # Explicit flush
            f.flush()
        
        debug_log(f"Successfully logged fallback flow", "FALLBACK")
        
    except Exception as e:
        debug_log(f"Error logging fallback flow: {e}", "FALLBACK")
        import traceback
        traceback.print_exc(file=sys.stderr)
