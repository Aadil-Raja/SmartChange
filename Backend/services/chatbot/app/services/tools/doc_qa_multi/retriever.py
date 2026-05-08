# app/services/tools/doc_qa_multi/retriever.py
"""
Parallel retrieval and answering of sub-questions.
"""
import sys
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor
from .schemas import SubQuestion, SubAnswer

# Import debug logger
from app.utils.debug_logger import debug_log


def retrieve_and_answer_subquestions(
    sub_questions: List[SubQuestion],
    chunk_db,
    doc_histories: dict,
    settings,
    all_active_doc_ids: List[int],  # NEW: All active documents for fallback retrieval
    use_deep_reranker: bool = False  # NEW: Flag for deep reranker
) -> List[SubAnswer]:
    """
    Process multiple sub-questions in parallel using existing retrieval logic.
    
    Args:
        sub_questions: List of SubQuestion objects to process
        chunk_db: Database session for chunk retrieval
        doc_histories: Document histories for context
        settings: Application settings
        all_active_doc_ids: All active document IDs (for fallback retrieval)
        
    Returns:
        List of SubAnswer objects (one per sub-question)
    """
    debug_log(f"Processing {len(sub_questions)} sub-questions in parallel", "RETRIEVER")
    
    # Process in parallel using ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=len(sub_questions)) as executor:
        futures = [
            executor.submit(
                _process_sub_question,
                sub_q,
                idx + 1,  # 1-indexed
                len(sub_questions),
                chunk_db,
                doc_histories,
                settings,
                all_active_doc_ids,
                use_deep_reranker  # NEW: Pass deep flag
            )
            for idx, sub_q in enumerate(sub_questions)
        ]
        
        results = [future.result() for future in futures]
    
    debug_log(f"Completed processing, {sum(1 for r in results if not r.failed)}/{len(results)} succeeded", "RETRIEVER")
    return results


def _process_sub_question(
    sub_question: SubQuestion,
    index: int,  # NEW: 1-indexed position
    total: int,  # NEW: Total number of sub-questions
    chunk_db,
    doc_histories: dict,
    settings,
    all_active_doc_ids: List[int],  # NEW: All active documents
    use_deep_reranker: bool = False  # NEW: Deep reranker flag
) -> SubAnswer:
    """
    Process a single sub-question using existing retrieval functions.
    
    This function imports and calls the existing functions from doc_qa_tool_structured.py
    to maintain consistency and avoid code duplication.
    
    IMPORTANT: Retrieves chunks from ALL active documents, not just decomposer's suggested ones.
    This allows cosine similarity to find the best chunks even if decomposer was wrong.
    """
    try:
        # ✅ Get buffer for this sub-question
        buf = None
        try:
            from app.services.chat_logger import get_logger
            logger = get_logger()
            if logger:
                buf = logger.get_sub_question_buffer(index=index, question=sub_question.question, total=total)
        except Exception as log_err:
            debug_log(f"Failed to get sub-question buffer: {log_err}", "RETRIEVER")
        
        debug_log(f"Processing: '{sub_question.question}'", "RETRIEVER")
        debug_log(f"  Decomposer suggested docs: {sub_question.doc_ids}", "RETRIEVER")
        debug_log(f"  Extracted keywords: {sub_question.keywords}", "RETRIEVER")
        debug_log(f"  Keywords type: {type(sub_question.keywords)}, length: {len(sub_question.keywords) if sub_question.keywords else 0}", "RETRIEVER")
        debug_log(f"  Fetching chunks from ALL active docs: {all_active_doc_ids}", "RETRIEVER")
        
        # Import existing functions from doc_qa_tool_structured
        from ..doc_qa_tool_structured import (
            calculate_thresholds,
            filter_chunks_by_threshold,
            build_conversation_context,
            invoke_llm_with_structured_output
        )
        
        # Import hybrid retrieval (NEW)
        from ..hybrid_retrieval import retrieve_chunks_for_all_docs_hybrid, _stage1_data, _stage2_data, _stage3_data
        
        # Step 1: Retrieve chunks from ALL active documents using HYBRID search
        # This combines:
        # - Dense retrieval (cosine similarity with embeddings)
        # - Sparse retrieval (BM25 keyword matching with extracted keywords)
        # - Reranking (cross-encoder for final scoring)
        
        # ✅ FIX: Pass keywords even if empty list (don't convert to None)
        keywords_to_use = sub_question.keywords if hasattr(sub_question, 'keywords') and sub_question.keywords else []
        debug_log(f"  Passing keywords to hybrid retrieval: {keywords_to_use}", "RETRIEVER")
        
        raw_results = retrieve_chunks_for_all_docs_hybrid(
            chunk_db=chunk_db,
            document_ids=all_active_doc_ids,  # Use all active docs
            question=sub_question.question,
            use_deep_reranker=use_deep_reranker,  # Pass deep flag
            keywords=keywords_to_use  # NEW: Pass keywords (empty list or populated)
        )
        
        # ✅ Store stages 1-3 in buffer (from global variables set by hybrid_retrieval)
        if buf:
            try:
                from ..hybrid_retrieval import _stage1_data, _stage2_data, _stage3_data
                
                if _stage1_data:
                    buf.stage1 = logger.format_stage1_all_chunks(_stage1_data)
                if _stage2_data:
                    buf.stage2 = logger.format_stage2_top20(_stage2_data)
                if _stage3_data:
                    buf.stage3 = logger.format_stage3_reranked(_stage3_data)
            except Exception as log_err:
                debug_log(f"Failed to store stages 1-3: {log_err}", "RETRIEVER")
        
        if not raw_results:
            return SubAnswer(
                question=sub_question.question,
                doc_ids=sub_question.doc_ids,
                answer="",
                citations=[],
                has_contradiction=False,
                failed=True,
                error_note=f"Could not retrieve information for: {sub_question.question}"
            )
        
        # Step 2: Check if results are from reranker (have rerank_score)
        has_rerank_scores = False
        for doc_data in raw_results.values():
            if doc_data["chunks"] and "rerank_score" in doc_data["chunks"][0]:
                has_rerank_scores = True
                break
        
        if has_rerank_scores:
            # Reranked results - apply threshold filtering on rerank scores
            debug_log(f"Using reranked results with threshold filtering", "RETRIEVER")
            
            # Step 1: Find the best rerank score and which document/section it came from
            best_rerank_score = float('-inf')
            best_rerank_doc_id = None
            best_rerank_section = None
            
            for doc_id, data in raw_results.items():
                if not data["chunks"]:
                    continue
                for c in data["chunks"]:
                    rerank_score = c.get('rerank_score', c.get('score', 0))
                    if rerank_score > best_rerank_score:
                        best_rerank_score = rerank_score
                        best_rerank_doc_id = doc_id
                        best_rerank_section = c.get('section_title', '')
            
            # Step 2: Calculate thresholds based on best rerank score
            # Three tiers: same doc + same section, same doc, other docs
            from app.core.config import get_settings
            settings = get_settings()
            
            if best_rerank_score >= 0:
                # Positive scores: use multiplication (traditional approach)
                same_section_threshold = best_rerank_score * settings.threshold_same_section_percent
                same_doc_threshold = best_rerank_score * settings.threshold_same_doc_percent
                other_doc_threshold = best_rerank_score * settings.threshold_other_doc_percent
            else:
                # Negative scores: use margin-based approach
                margin_same_section = abs(best_rerank_score) * settings.threshold_same_section_margin_percent
                margin_same_doc = abs(best_rerank_score) * settings.threshold_same_doc_margin_percent
                margin_other = abs(best_rerank_score) * settings.threshold_other_doc_margin_percent
                
                same_section_threshold = best_rerank_score - margin_same_section  # Most lenient
                same_doc_threshold = best_rerank_score - margin_same_doc          # Medium
                other_doc_threshold = best_rerank_score - margin_other            # Most strict
            
            debug_log(f"Best rerank score: {best_rerank_score:.4f} from doc {best_rerank_doc_id}, section '{best_rerank_section}'", "RETRIEVER")
            debug_log(f"Thresholds: same_section={same_section_threshold:.4f}, same_doc={same_doc_threshold:.4f}, other_doc={other_doc_threshold:.4f}", "RETRIEVER")
            
            # Step 3: Collect all chunks that pass threshold
            passing_chunks_with_metadata = []
            dropped_chunks_with_metadata = []
            
            # Dense fallback: use dense score of the BEST RERANKER chunk (not max dense overall)
            # Find the single chunk with highest rerank score
            best_rerank_chunk = None
            for doc_id, data in raw_results.items():
                if not data["chunks"]:
                    continue
                for c in data["chunks"]:
                    if best_rerank_chunk is None or c.get('rerank_score', float('-inf')) > best_rerank_chunk.get('rerank_score', float('-inf')):
                        best_rerank_chunk = c
            
            # 90% of that specific chunk's dense score
            if best_rerank_chunk is not None:
                best_rerank_chunk_dense = best_rerank_chunk.get('dense_score', 0)
                dense_threshold = best_rerank_chunk_dense * settings.dense_fallback_percent
            else:
                dense_threshold = 0.0
            
            debug_log(f"Dense fallback: best rerank chunk dense={best_rerank_chunk_dense:.4f}, threshold={dense_threshold:.4f} ({int(settings.dense_fallback_percent*100)}%)", "RETRIEVER")
            
            for doc_id, data in raw_results.items():
                if not data["chunks"]:
                    continue
                
                for c in data["chunks"]:
                    rerank_score = c.get('rerank_score', c.get('score', 0))
                    dense_score = c.get('dense_score', 0)
                    chunk_section = c.get('section_title', '')
                    
                    # Determine threshold tier for this chunk
                    if doc_id == best_rerank_doc_id and chunk_section == best_rerank_section:
                        threshold = same_section_threshold
                        tier = "same_section"
                    elif doc_id == best_rerank_doc_id:
                        threshold = same_doc_threshold
                        tier = "same_doc"
                    else:
                        threshold = other_doc_threshold
                        tier = "other_doc"
                    
                    item = {
                        "doc_id": doc_id,
                        "doc_title": data["doc_title"],
                        "cloudinary_url": data.get("cloudinary_url"),
                        "chunk": c,
                        "threshold": threshold,
                        "tier": tier,
                        "pass_reason": None  # Track why it passed
                    }
                    
                    # DUAL-PASS FILTERING:
                    # Pass 1: Reranker-based threshold (existing logic)
                    # Pass 2: Dense score-based (NEW - catches high semantic similarity chunks)
                    passed_rerank = rerank_score >= threshold
                    passed_dense = dense_score >= dense_threshold
                    
                    if passed_rerank or passed_dense:
                        if passed_rerank and passed_dense:
                            item["pass_reason"] = "rerank+dense"
                        elif passed_rerank:
                            item["pass_reason"] = "rerank"
                        else:
                            item["pass_reason"] = "dense_fallback"
                        passing_chunks_with_metadata.append(item)
                    else:
                        dropped_chunks_with_metadata.append(item)
            
            # Step 4: Sort passing chunks by rerank score and take top K
            passing_chunks_with_metadata.sort(
                key=lambda x: x["chunk"].get("rerank_score", x["chunk"].get("score", 0)),
                reverse=True
            )
            
            # Limit to max chunks to LLM
            top_chunks = passing_chunks_with_metadata[:settings.max_chunks_to_llm]
            
            debug_log(f"{len(passing_chunks_with_metadata)} chunks passed threshold, using top {len(top_chunks)}", "RETRIEVER")
            debug_log(f"{len(dropped_chunks_with_metadata)} chunks dropped below threshold", "RETRIEVER")
            
            # Step 5: Build context blocks and chunk map from top chunks
            context_blocks = []
            chunk_map = {}
            passing_doc_ids = []
            doc_chunks = {}  # Group chunks by document for context blocks
            
            for item in top_chunks:
                doc_id = item["doc_id"]
                doc_title = item["doc_title"]
                c = item["chunk"]
                
                if doc_id not in doc_chunks:
                    doc_chunks[doc_id] = {
                        "doc_title": doc_title,
                        "cloudinary_url": item["cloudinary_url"],
                        "chunks": []
                    }
                    passing_doc_ids.append(doc_id)
                
                doc_chunks[doc_id]["chunks"].append(c)
                
                cid = f"DOC{doc_id}_CHUNK{c['chunk_index']}"
                chunk_map[cid] = {
                    "doc_id": doc_id,
                    "doc_title": doc_title,
                    "cloudinary_url": item["cloudinary_url"],
                    "page": c.get("start_page_num"),
                    "section": c.get("section_title")
                }
            
            # Build context blocks
            total_chunk_texts = 0
            for doc_id in passing_doc_ids:
                data = doc_chunks[doc_id]
                block_lines = [f"[Source: {data['doc_title']}]"]
                for c in data["chunks"]:
                    cid = f"DOC{doc_id}_CHUNK{c['chunk_index']}"
                    chunk_text = c['text']
                    block_lines.append(f"[CHUNK_ID: {cid}]\n{chunk_text}")
                    total_chunk_texts += 1
                    debug_log(f"Adding chunk {cid}: text_length={len(chunk_text)}, preview='{chunk_text[:100]}'", "RETRIEVER")
                context_blocks.append("\n\n".join(block_lines))
            
            debug_log(f"Built {len(context_blocks)} context blocks with {total_chunk_texts} total chunks", "RETRIEVER")
            
            # For logging
            best_score = best_rerank_score
            best_doc_id = best_rerank_doc_id
            
            # ✅ Store Stage 4 in buffer
            if buf:
                try:
                    # Prepare passed chunks for logging
                    passed_for_log = []
                    for item in top_chunks:
                        passed_for_log.append({
                            'chunk_index': item["chunk"].get('chunk_index'),
                            'doc_id': item["doc_id"],
                            'rerank_score': item["chunk"].get('rerank_score', 0),
                            'dense_score': item["chunk"].get('dense_score', 0),
                            'threshold_used': item["threshold"],
                            'tier': item["tier"],
                            'pass_reason': item.get("pass_reason", "unknown"),
                            'start_page_num': item["chunk"].get('start_page_num'),
                            'section_title': item["chunk"].get('section_title')
                        })
                    
                    # Prepare dropped chunks for logging
                    dropped_for_log = []
                    for item in dropped_chunks_with_metadata:
                        dropped_for_log.append({
                            'chunk_index': item["chunk"].get('chunk_index'),
                            'doc_id': item["doc_id"],
                            'rerank_score': item["chunk"].get('rerank_score', 0),
                            'threshold_used': item["threshold"],
                            'tier': item["tier"],
                            'start_page_num': item["chunk"].get('start_page_num'),
                            'section_title': item["chunk"].get('section_title')
                        })
                    
                    buf.stage4 = logger.format_stage4_threshold(
                        best_score=best_rerank_score,
                        best_doc_id=best_rerank_doc_id,
                        best_section=best_rerank_section,
                        thresholds={
                            'same_section': same_section_threshold,
                            'same_doc': same_doc_threshold,
                            'other_doc': other_doc_threshold
                        },
                        passed_chunks=passed_for_log,
                        dropped_chunks=dropped_for_log
                    )
                except Exception as log_err:
                    debug_log(f"Failed to store stage 4: {log_err}", "RETRIEVER")
            
            # ── DEBUG: print reranked chunks with threshold filtering ──
            debug_log(f"\n[CHUNKS] Sub-question: '{sub_question.question}'", "RETRIEVER")
            debug_log(f"Using RERANKED results with 3-tier threshold filtering", "CHUNKS")
            debug_log(f"Best rerank score: {best_rerank_score:.4f} from doc {best_rerank_doc_id}, section '{best_rerank_section}'", "CHUNKS")
            debug_log(f"Thresholds: same_section={same_section_threshold:.4f} (50%), same_doc={same_doc_threshold:.4f} (65%), other_doc={other_doc_threshold:.4f} (75%)", "CHUNKS")
            debug_log(f"Decomposer suggested: {sub_question.doc_ids}", "CHUNKS")
            
            debug_log(f"\n[CHUNKS] ✅ PASSING CHUNKS (top {len(top_chunks)} after dual-pass filtering):", "RETRIEVER")
            for i, item in enumerate(top_chunks, 1):
                doc_id = item["doc_id"]
                doc_title = item["doc_title"]
                c = item["chunk"]
                threshold = item["threshold"]
                tier = item["tier"]
                pass_reason = item.get("pass_reason", "unknown")
                rerank_score = c.get('rerank_score', c.get('score', 0))
                dense_score = c.get('dense_score', 0)
                chunk_section = c.get('section_title', '')
                decomposer_match = "✓ SUGGESTED" if doc_id in sub_question.doc_ids else "⚠ NOT SUGGESTED"
                
                debug_log(f"  {i}. Doc {doc_id} '{doc_title}' [{decomposer_match}] [{tier}] [{pass_reason}] | rerank={rerank_score:.4f} dense={dense_score:.4f} | page={c.get('start_page_num')} | sec='{chunk_section[:40]}'", "CHUNKS")
            
            if dropped_chunks_with_metadata:
                debug_log(f"\n[CHUNKS] ❌ DROPPED CHUNKS ({len(dropped_chunks_with_metadata)} below threshold):", "RETRIEVER")
                for i, item in enumerate(dropped_chunks_with_metadata[:5], 1):  # Show first 5
                    doc_id = item["doc_id"]
                    doc_title = item["doc_title"]
                    c = item["chunk"]
                    threshold = item["threshold"]
                    tier = item["tier"]
                    rerank_score = c.get('rerank_score', c.get('score', 0))
                    chunk_section = c.get('section_title', '')
                    
                    debug_log(f"  {i}. Doc {doc_id} '{doc_title}' [{tier}] | rerank={rerank_score:.4f} < {threshold:.4f} | page={c.get('start_page_num')} | sec='{chunk_section[:40]}'", "CHUNKS")
                
                if len(dropped_chunks_with_metadata) > 5:
                    debug_log(f"  ... and {len(dropped_chunks_with_metadata) - 5} more dropped chunks", "CHUNKS")
            
            debug_log(f"\n[CHUNKS] TOTAL: {len(top_chunks)} chunks passed (max 20), {len(dropped_chunks_with_metadata)} dropped | passing_docs={passing_doc_ids}", "RETRIEVER")
            # ── END DEBUG ──
            
            debug_log(f"Using {len(context_blocks)} context blocks from {len(passing_doc_ids)} docs", "RETRIEVER")
            
        else:
            # Not reranked - use traditional threshold filtering
            debug_log(f"Using threshold filtering (no rerank scores found)", "RETRIEVER")
            
            # Calculate thresholds
            best_score, best_doc_id, same_doc_threshold, other_doc_threshold = calculate_thresholds(raw_results)
            
            # Filter chunks by threshold
            context_blocks, chunk_map, passing_doc_ids = filter_chunks_by_threshold(
                raw_results=raw_results,
                best_doc_id=best_doc_id,
                same_doc_threshold=same_doc_threshold,
                other_doc_threshold=other_doc_threshold
            )

            # ── DEBUG: print chunk scores for this sub-question ──
            debug_log(f"\n[CHUNKS] Sub-question: '{sub_question.question}'", "RETRIEVER")
            debug_log(f"Decomposer suggested: {sub_question.doc_ids}, Cosine similarity found best in: doc {best_doc_id}", "CHUNKS")
            debug_log(f"Thresholds — best_score={best_score:.4f}, best_doc_id={best_doc_id}, same={same_doc_threshold:.4f}, other={other_doc_threshold:.4f}", "CHUNKS")
            total_pass = 0
            total_drop = 0
            for doc_id, data in raw_results.items():
                thresh = same_doc_threshold if doc_id == best_doc_id else other_doc_threshold
                doc_pass = sum(1 for c in data["chunks"] if c["score"] >= thresh)
                doc_drop = len(data["chunks"]) - doc_pass
                total_pass += doc_pass
                total_drop += doc_drop
                
                # Highlight if this doc was NOT suggested by decomposer but has passing chunks
                decomposer_match = "✓ SUGGESTED" if doc_id in sub_question.doc_ids else "⚠ NOT SUGGESTED"
                debug_log(f"Doc {doc_id} '{data['doc_title']}' [{decomposer_match}] (thresh={thresh:.4f}) — {doc_pass} pass, {doc_drop} drop:", "CHUNKS")
                
                for c in data["chunks"]:
                    status = "✓ PASS" if c["score"] >= thresh else "✗ DROP"
                    debug_log(f"  [{status}] score={c['score']:.4f} | page={c.get('start_page_num')} | sec='{c.get('section_title','')[:40]}' | text='{c['text'][:80].strip()}'", "CHUNKS")
            debug_log(f"TOTAL: {total_pass} passed, {total_drop} dropped | passing_docs={passing_doc_ids} | context_blocks={len(context_blocks)}", "CHUNKS")
            # ── END DEBUG ──
        
        # ── LOG CHUNKS TO FILE ──
        try:
            from app.services.chat_logger import get_logger
            logger = get_logger()
            if logger:
                # For reranked results, create a modified structure for logging
                if has_rerank_scores:
                    # Reconstruct raw_results format with passing and dropped chunks
                    log_raw_results = {}
                    
                    # Add passing chunks
                    for doc_id, data in doc_chunks.items():
                        log_raw_results[doc_id] = {
                            "doc_title": data["doc_title"],
                            "cloudinary_url": data["cloudinary_url"],
                            "chunks": data["chunks"],
                            "passing_chunks": data["chunks"],
                            "dropped_chunks": []
                        }
                    
                    # Add dropped chunks
                    for item in dropped_chunks_with_metadata:
                        doc_id = item["doc_id"]
                        if doc_id not in log_raw_results:
                            log_raw_results[doc_id] = {
                                "doc_title": item["doc_title"],
                                "cloudinary_url": item["cloudinary_url"],
                                "chunks": [],
                                "passing_chunks": [],
                                "dropped_chunks": []
                            }
                        log_raw_results[doc_id]["dropped_chunks"].append(item["chunk"])
                else:
                    log_raw_results = raw_results  # Use original results with all chunks
                
                # Log chunk retrieval if method exists (for backward compatibility)
                if hasattr(logger, 'log_chunk_retrieval'):
                    logger.log_chunk_retrieval(
                        sub_question=sub_question.question,
                        raw_results=log_raw_results,
                        best_score=best_score,
                        best_doc_id=best_doc_id,
                        same_doc_threshold=same_doc_threshold,
                        other_doc_threshold=other_doc_threshold,
                        passing_doc_ids=passing_doc_ids,
                        has_rerank_scores=has_rerank_scores,
                        best_section=best_rerank_section if has_rerank_scores else None,
                        same_section_threshold=same_section_threshold if has_rerank_scores else None,
                        chunk_db=chunk_db  # NEW: Pass database session
                    )
                else:
                    # Use available ChatLogger methods instead
                    debug_log(f"Detailed logging: {len(passing_doc_ids)} passing docs, best_score={best_score:.4f}", "RETRIEVER")
        except Exception as log_err:
            debug_log(f"Logging error: {log_err}", "RETRIEVER")
            import traceback
            traceback.print_exc(file=sys.stderr)
        # ── END LOG ──
        
        if not context_blocks:
            return SubAnswer(
                question=sub_question.question,
                doc_ids=sub_question.doc_ids,
                answer="",
                citations=[],
                has_contradiction=False,
                failed=True,
                error_note=f"No relevant information found for: {sub_question.question}"
            )
        
        # Step 4: Build conversation context (use all active docs for history)
        conversation_context = build_conversation_context(
            passing_doc_ids=passing_doc_ids,
            doc_histories=doc_histories,
            document_ids=all_active_doc_ids  # ✅ CHANGED: Use all active docs
        )
        
        # Step 5: Invoke LLM with structured output
        debug_log(f"Calling invoke_llm_with_structured_output with {len(context_blocks)} blocks", "RETRIEVER")
        result = invoke_llm_with_structured_output(
            question=sub_question.question,
            conversation_context=conversation_context,
            context_blocks=context_blocks,
            chunk_map=chunk_map
        )
        
        debug_log(f"LLM returned {len(result.get('retrieved_contexts', []))} contexts", "RETRIEVER")
        
        # ✅ Store Stage 5 in buffer and flush all stages atomically
        if buf:
            try:
                buf.stage5 = logger.format_stage5_answer(
                    answer=result.get('answer', ''),
                    citations=result.get('citations', []),
                    tokens_input=result.get('tokens_input', 0),
                    tokens_output=result.get('tokens_output', 0)
                )
                
                # Flush all stages to file atomically
                logger.flush_sub_question(index)
            except Exception as log_err:
                debug_log(f"Failed to store stage 5 or flush: {log_err}", "RETRIEVER")
        
        # Step 6: Return SubAnswer with actual passing doc IDs (not decomposer's suggestion)
        return SubAnswer(
            question=sub_question.question,
            doc_ids=passing_doc_ids,  # ✅ CHANGED: Use actual docs that had passing chunks
            answer=result.get('answer', ''),
            citations=result.get('citations', []),
            # retrieved_contexts removed - now using side channel
            has_contradiction=result.get('has_contradiction', False),
            failed=False,
            error_note="",
            tokens_input=result.get('tokens_input', 0),
            tokens_output=result.get('tokens_output', 0)
        )
        
    except Exception as e:
        debug_log(f"Error processing sub-question: {e}", "RETRIEVER")
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        return SubAnswer(
            question=sub_question.question,
            doc_ids=sub_question.doc_ids,
            answer="",
            citations=[],
            retrieved_contexts=[],  # ✅ NEW: Empty list for failed retrieval
            has_contradiction=False,
            failed=True,
            error_note=f"Could not retrieve information for: {sub_question.question}"
        )
