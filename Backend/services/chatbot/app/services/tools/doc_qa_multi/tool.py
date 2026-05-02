# app/services/tools/doc_qa_multi/tool.py
"""
Multi-document QA tool factory - orchestrates decomposition, retrieval, and merging.
"""
import sys
import json
from langchain_core.tools import tool
from typing import Dict, List

from .decomposer import decompose_question
from .retriever import retrieve_and_answer_subquestions
from .merger import merge_answers
from app.core.config import get_settings


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
            print(f"[PREFETCH] Error getting sections for doc {doc_id}: {e}", file=sys.stderr)
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
    def doc_qa_multi_tool(questions: List[str]) -> dict:
        
        """
        Answer one or more questions about document content.
        
        CRITICAL INSTRUCTIONS:
        - If user asks ONE question: pass it as a single-item list, e.g., ["What is Aadil's GPA?"]
        - If user asks MULTIPLE questions: break them into separate list items, e.g., 
          ["What is Aadil's GPA?", "What are PSL teams?", "Who wrote Harry Potter?"]
        - Each question should be a complete, standalone question
        - Call this tool ONLY ONCE per user message
        
        EXAMPLES:
        
        User: "What is Aadil's education background?"
        ✅ CORRECT: doc_qa_multi_tool(questions=["What is Aadil's education background?"])
        
        User: "What are Aadil's projects and what are the PSL teams?"
        ✅ CORRECT: doc_qa_multi_tool(questions=["What are Aadil's projects?", "What are the PSL teams?"])
        ❌ WRONG: doc_qa_multi_tool(questions=["What are Aadil's projects and what are the PSL teams?"])
        
        User: "Tell me about Aadil's skills, the PSL format, and Harry Potter books"
        ✅ CORRECT: doc_qa_multi_tool(questions=[
            "What are Aadil's skills?",
            "What is the PSL tournament format?", 
            "What are the Harry Potter books?"
        ])
        
        User: "What is Aadil's CGPA, internship, PSL teams, Harry Potter book count, and PSL prize?"
        ✅ CORRECT: doc_qa_multi_tool(questions=[
            "What is Aadil's CGPA?",
            "What internship did Aadil do?",
            "What are the PSL teams?",
            "How many Harry Potter books are there?",
            "What is the PSL prize money?"
        ])
        
        After this tool returns, STOP. Do not call any other tool. Return the output as-is.
        
        Returns:
            Dict with answer, has_contradiction, citations, tokens_input, tokens_output
        """
        try:
            # Combine questions into single string for processing
            if len(questions) == 1:
                question = questions[0]
                print(f"\n[MULTI-DOC TOOL] Processing single question: '{question}'", file=sys.stderr)
            else:
                question = " ".join(questions)
                print(f"\n[MULTI-DOC TOOL] Processing {len(questions)} questions combined: '{question}'", file=sys.stderr)
            
            print(f"[MULTI-DOC TOOL] Active documents: {document_ids}", file=sys.stderr)
            
            # ✅ NEW: Log user turn at the start
            try:
                from app.services.chat_logger import get_logger
                logger = get_logger()
                if logger:
                    logger.log_user_turn(question, document_ids)
            except Exception as log_err:
                print(f"[MULTI-DOC TOOL] Failed to log user turn: {log_err}", file=sys.stderr)
            
            # Optimization: Skip decomposition if only 1 document
            if len(document_ids) == 1:
                print(f"[MULTI-DOC TOOL] Only 1 document active, skipping decomposition", file=sys.stderr)
                return _fallback_to_single_doc(question, chunk_db, document_ids, doc_histories, use_deep_reranker)
            
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
                print(f"[MULTI-DOC TOOL] Using pre-fetched section names", file=sys.stderr)
            else:
                print(f"[MULTI-DOC TOOL] Pre-fetching section names...", file=sys.stderr)
                section_names_map = _prefetch_section_names(chunk_db, document_ids)
            
            # Step 1: Decompose the question (with pre-fetched sections)
            print(f"[MULTI-DOC TOOL] Step 1: Decomposing question...", file=sys.stderr)
            decomposed = decompose_question(
                question=question,
                document_ids=document_ids,
                doc_histories=doc_histories,
                llm=llm,
                management_db=chunk_db,  # Pass management DB for section retrieval
                section_names_map=section_names_map  # ✅ NEW: Pass pre-fetched sections
            )
            
            # Step 2: Confidence gate - fall back to single-doc if needed
            if not decomposed.is_cross_doc or decomposed.confidence < 0.7 or not decomposed.sub_questions:
                print(f"[MULTI-DOC TOOL] Falling back to single-doc path (is_cross_doc={decomposed.is_cross_doc}, confidence={decomposed.confidence})", file=sys.stderr)
                return _fallback_to_single_doc(question, chunk_db, document_ids, doc_histories, use_deep_reranker)
            
            print(f"[MULTI-DOC TOOL] Using multi-doc path with {len(decomposed.sub_questions)} sub-questions", file=sys.stderr)
            
            # Step 3: Retrieve and answer sub-questions in parallel
            print(f"[MULTI-DOC TOOL] Step 2: Retrieving answers in parallel...", file=sys.stderr)
            sub_answers = retrieve_and_answer_subquestions(
                sub_questions=decomposed.sub_questions,
                chunk_db=chunk_db,
                doc_histories=doc_histories,
                settings=settings,
                all_active_doc_ids=document_ids,  # ✅ NEW: Pass all active docs for fallback retrieval
                use_deep_reranker=use_deep_reranker  # NEW: Pass deep flag
            )
            
            # Step 4: Merge answers
            print(f"[MULTI-DOC TOOL] Step 3: Merging answers...", file=sys.stderr)
            merged = merge_answers(
                sub_answers=sub_answers,
                original_question=question,
                llm=llm
            )
            
            # ✅ NEW: Log merged answer
            try:
                from app.services.chat_logger import get_logger
                logger = get_logger()
                if logger:
                    logger.log_merged_answer(merged.answer, merged.citations)
            except Exception as log_err:
                print(f"[MULTI-DOC TOOL] Failed to log merged answer: {log_err}", file=sys.stderr)
            
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
                print(f"[MULTI-DOC TOOL] Logging error: {log_error}", file=sys.stderr)
            
            # Step 6: Return dict in same format as single-doc tool (NOT JSON string)
            result = {
                "answer": merged.answer,
                "has_contradiction": merged.has_contradiction,
                "citations": merged.citations,
                "tokens_input": merged.tokens_input,
                "tokens_output": merged.tokens_output,
                "call_type": "doc_qa",
            }
            
            print(f"[MULTI-DOC TOOL] Complete! Returning merged answer with {len(merged.citations)} citations", file=sys.stderr)
            return result
            
        except Exception as e:
            print(f"[MULTI-DOC TOOL] Error in multi-doc flow: {e}, falling back to single-doc", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            
            # Fall back to single-doc tool on any error
            return _fallback_to_single_doc(question, chunk_db, document_ids, doc_histories, use_deep_reranker)
    
    return doc_qa_multi_tool


def _fallback_to_single_doc(question: str, chunk_db, document_ids: List[int], doc_histories: Dict, use_deep_reranker: bool = False):
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
        print(f"[MULTI-DOC TOOL] Executing single-doc fallback", file=sys.stderr)
        
        # Import and use hybrid retrieval for single-doc fallback
        from ..hybrid_retrieval import retrieve_chunks_for_all_docs_hybrid
        from ..doc_qa_tool_structured import (
            calculate_thresholds,
            filter_chunks_by_threshold,
            build_conversation_context,
            invoke_llm_with_structured_output
        )
        
        # Use hybrid retrieval with deep reranker flag
        raw_results = retrieve_chunks_for_all_docs_hybrid(
            chunk_db=chunk_db,
            document_ids=document_ids,
            question=question,
            use_deep_reranker=use_deep_reranker
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
            print(f"[FALLBACK] Using reranked results, skipping threshold filtering", file=sys.stderr)
            
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
            
            print(f"[FALLBACK] Using {len(context_blocks)} context blocks from {len(passing_doc_ids)} docs", file=sys.stderr)
            
        else:
            # Not reranked - use traditional threshold filtering
            print(f"[FALLBACK] Using threshold filtering (no rerank scores found)", file=sys.stderr)
            
            # Calculate thresholds
            best_score, best_doc_id, same_doc_threshold, other_doc_threshold = calculate_thresholds(raw_results)
            
            # ✅ Log threshold calculation
            print(f"[FALLBACK] Threshold calculation:", file=sys.stderr)
            print(f"[FALLBACK]   Best score: {best_score:.4f} from doc {best_doc_id}", file=sys.stderr)
            print(f"[FALLBACK]   Same doc threshold: {same_doc_threshold:.4f}", file=sys.stderr)
            print(f"[FALLBACK]   Other doc threshold: {other_doc_threshold:.4f}", file=sys.stderr)
            
            # Filter chunks by threshold
            context_blocks, chunk_map, passing_doc_ids = filter_chunks_by_threshold(
                raw_results=raw_results,
                best_doc_id=best_doc_id,
                same_doc_threshold=same_doc_threshold,
                other_doc_threshold=other_doc_threshold
            )
            
            # ✅ Log filtering results
            print(f"[FALLBACK] After threshold filtering:", file=sys.stderr)
            print(f"[FALLBACK]   Passing docs: {passing_doc_ids}", file=sys.stderr)
            print(f"[FALLBACK]   Context blocks: {len(context_blocks)}", file=sys.stderr)
            print(f"[FALLBACK]   Chunks in map: {len(chunk_map)}", file=sys.stderr)
        
        if not context_blocks:
            print(f"[FALLBACK] ❌ NO CHUNKS AVAILABLE - returning empty answer", file=sys.stderr)
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
            print(f"[FALLBACK] Logging error: {log_error}", file=sys.stderr)
        
        print(f"[MULTI-DOC TOOL] Single-doc fallback complete", file=sys.stderr)
        return result
        
    except Exception as e:
        print(f"[MULTI-DOC TOOL] Error in single-doc fallback: {e}", file=sys.stderr)
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
        
        logger = get_logger()
        if not logger:
            print(f"[MULTI-DOC TOOL] No logger available, skipping logging", file=sys.stderr)
            return
        
        print(f"[MULTI-DOC TOOL] Logging multi-doc flow to chathead log", file=sys.stderr)
        
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
            
        print(f"[MULTI-DOC TOOL] Successfully logged multi-doc flow", file=sys.stderr)
        
    except Exception as e:
        print(f"[MULTI-DOC TOOL] Error logging multi-doc flow: {e}", file=sys.stderr)
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
        
        logger = get_logger()
        if not logger:
            print(f"[FALLBACK] No logger available, skipping logging", file=sys.stderr)
            return
        
        print(f"[FALLBACK] Logging fallback flow to chathead log", file=sys.stderr)
        
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
        
        print(f"[FALLBACK] Successfully logged fallback flow", file=sys.stderr)
        
    except Exception as e:
        print(f"[FALLBACK] Error logging fallback flow: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
