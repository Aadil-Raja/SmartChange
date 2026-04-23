# app/services/tools/doc_qa_multi/retriever.py
"""
Parallel retrieval and answering of sub-questions.
"""
import sys
from typing import List
from concurrent.futures import ThreadPoolExecutor
from .schemas import SubQuestion, SubAnswer


def retrieve_and_answer_subquestions(
    sub_questions: List[SubQuestion],
    chunk_db,
    doc_histories: dict,
    settings
) -> List[SubAnswer]:
    """
    Process multiple sub-questions in parallel using existing retrieval logic.
    
    Args:
        sub_questions: List of SubQuestion objects to process
        chunk_db: Database session for chunk retrieval
        doc_histories: Document histories for context
        settings: Application settings
        
    Returns:
        List of SubAnswer objects (one per sub-question)
    """
    print(f"[RETRIEVER] Processing {len(sub_questions)} sub-questions in parallel", file=sys.stderr)
    
    # Process in parallel using ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=len(sub_questions)) as executor:
        futures = [
            executor.submit(
                _process_sub_question,
                sub_q,
                chunk_db,
                doc_histories,
                settings
            )
            for sub_q in sub_questions
        ]
        
        results = [future.result() for future in futures]
    
    print(f"[RETRIEVER] Completed processing, {sum(1 for r in results if not r.failed)}/{len(results)} succeeded", file=sys.stderr)
    return results


def _process_sub_question(
    sub_question: SubQuestion,
    chunk_db,
    doc_histories: dict,
    settings
) -> SubAnswer:
    """
    Process a single sub-question using existing retrieval functions.
    
    This function imports and calls the existing functions from doc_qa_tool_structured.py
    to maintain consistency and avoid code duplication.
    """
    try:
        print(f"[RETRIEVER] Processing: '{sub_question.question}' for docs {sub_question.doc_ids}", file=sys.stderr)
        
        # Import existing functions from doc_qa_tool_structured
        from ..doc_qa_tool_structured import (
            retrieve_chunks_for_all_docs,
            calculate_thresholds,
            filter_chunks_by_threshold,
            build_conversation_context,
            invoke_llm_with_structured_output
        )
        
        # Step 1: Retrieve chunks for the sub-question's target documents
        raw_results = retrieve_chunks_for_all_docs(
            chunk_db=chunk_db,
            document_ids=sub_question.doc_ids,
            question=sub_question.question
        )
        
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
        
        # Step 2: Calculate thresholds
        best_score, best_doc_id, same_doc_threshold, other_doc_threshold = calculate_thresholds(raw_results)
        
        # Step 3: Filter chunks by threshold
        context_blocks, chunk_map, passing_doc_ids = filter_chunks_by_threshold(
            raw_results=raw_results,
            best_doc_id=best_doc_id,
            same_doc_threshold=same_doc_threshold,
            other_doc_threshold=other_doc_threshold
        )

        # ── DEBUG: print chunk scores for this sub-question ──
        print(f"\n[CHUNKS] Sub-question: '{sub_question.question}' docs={sub_question.doc_ids}", file=sys.stderr)
        print(f"[CHUNKS] Thresholds — best_score={best_score:.4f}, best_doc_id={best_doc_id}, same={same_doc_threshold:.4f}, other={other_doc_threshold:.4f}", file=sys.stderr)
        total_pass = 0
        total_drop = 0
        for doc_id, data in raw_results.items():
            thresh = same_doc_threshold if doc_id == best_doc_id else other_doc_threshold
            doc_pass = sum(1 for c in data["chunks"] if c["score"] >= thresh)
            doc_drop = len(data["chunks"]) - doc_pass
            total_pass += doc_pass
            total_drop += doc_drop
            print(f"[CHUNKS] Doc {doc_id} '{data['doc_title']}' (thresh={thresh:.4f}) — {doc_pass} pass, {doc_drop} drop:", file=sys.stderr)
            for c in data["chunks"]:
                status = "✓ PASS" if c["score"] >= thresh else "✗ DROP"
                print(f"[CHUNKS]   [{status}] score={c['score']:.4f} | page={c.get('start_page_num')} | sec='{c.get('section_title','')[:40]}' | text='{c['text'][:80].strip()}'", file=sys.stderr)
        print(f"[CHUNKS] TOTAL: {total_pass} passed, {total_drop} dropped | passing_docs={passing_doc_ids} | context_blocks={len(context_blocks)}", file=sys.stderr)
        # ── END DEBUG ──
        
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
        
        # Step 4: Build conversation context
        conversation_context = build_conversation_context(
            passing_doc_ids=passing_doc_ids,
            doc_histories=doc_histories,
            document_ids=sub_question.doc_ids
        )
        
        # Step 5: Invoke LLM with structured output
        result = invoke_llm_with_structured_output(
            question=sub_question.question,
            conversation_context=conversation_context,
            context_blocks=context_blocks,
            chunk_map=chunk_map
        )
        
        # Step 6: Return SubAnswer
        return SubAnswer(
            question=sub_question.question,
            doc_ids=sub_question.doc_ids,
            answer=result.get('answer', ''),
            citations=result.get('citations', []),
            has_contradiction=result.get('has_contradiction', False),
            failed=False,
            error_note="",
            tokens_input=result.get('tokens_input', 0),
            tokens_output=result.get('tokens_output', 0)
        )
        
    except Exception as e:
        print(f"[RETRIEVER] Error processing sub-question: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        return SubAnswer(
            question=sub_question.question,
            doc_ids=sub_question.doc_ids,
            answer="",
            citations=[],
            has_contradiction=False,
            failed=True,
            error_note=f"Could not retrieve information for: {sub_question.question}"
        )
