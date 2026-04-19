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


def make_doc_qa_multi_tool(chunk_db, document_ids: List[int], doc_histories: Dict):
    """
    Create a multi-document QA tool with intelligent question decomposition.
    
    This tool:
    1. Analyzes if the question spans multiple documents
    2. If yes and confident, decomposes into sub-questions
    3. Retrieves answers in parallel
    4. Merges into one coherent response
    5. Falls back to single-doc tool if not needed or on error
    
    Args:
        chunk_db: Database session for chunk retrieval
        document_ids: List of active document IDs
        doc_histories: Dict mapping doc_id to {doc_title, summary, last_n_messages}
        
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
            
            # Optimization: Skip decomposition if only 1 document
            if len(document_ids) == 1:
                print(f"[MULTI-DOC TOOL] Only 1 document active, skipping decomposition", file=sys.stderr)
                return _fallback_to_single_doc(question, chunk_db, document_ids, doc_histories)
            
            # Import LLM provider
            from shared.llm import create_llm_provider
            llm = create_llm_provider(
                llm_provider=settings.llm_provider,
                llm_model=settings.llm_model,
                google_api_key=settings.google_api_key,
                openai_api_key=settings.openai_api_key
            )
            
            # Step 1: Decompose the question
            print(f"[MULTI-DOC TOOL] Step 1: Decomposing question...", file=sys.stderr)
            decomposed = decompose_question(
                question=question,
                document_ids=document_ids,
                doc_histories=doc_histories,
                llm=llm
            )
            
            # Step 2: Confidence gate - fall back to single-doc if needed
            if not decomposed.is_cross_doc or decomposed.confidence < 0.7 or not decomposed.sub_questions:
                print(f"[MULTI-DOC TOOL] Falling back to single-doc path (is_cross_doc={decomposed.is_cross_doc}, confidence={decomposed.confidence})", file=sys.stderr)
                return _fallback_to_single_doc(question, chunk_db, document_ids, doc_histories)
            
            print(f"[MULTI-DOC TOOL] Using multi-doc path with {len(decomposed.sub_questions)} sub-questions", file=sys.stderr)
            
            # Step 3: Retrieve and answer sub-questions in parallel
            print(f"[MULTI-DOC TOOL] Step 2: Retrieving answers in parallel...", file=sys.stderr)
            sub_answers = retrieve_and_answer_subquestions(
                sub_questions=decomposed.sub_questions,
                chunk_db=chunk_db,
                doc_histories=doc_histories,
                settings=settings
            )
            
            # Step 4: Merge answers
            print(f"[MULTI-DOC TOOL] Step 3: Merging answers...", file=sys.stderr)
            merged = merge_answers(
                sub_answers=sub_answers,
                original_question=question,
                llm=llm
            )
            
            # Step 5: Log the multi-doc flow (if logger is available)
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
                "tokens_output": merged.tokens_output
            }
            
            print(f"[MULTI-DOC TOOL] Complete! Returning merged answer with {len(merged.citations)} citations", file=sys.stderr)
            return result
            
        except Exception as e:
            print(f"[MULTI-DOC TOOL] Error in multi-doc flow: {e}, falling back to single-doc", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            
            # Fall back to single-doc tool on any error
            return _fallback_to_single_doc(question, chunk_db, document_ids, doc_histories)
    
    return doc_qa_multi_tool


def _fallback_to_single_doc(question: str, chunk_db, document_ids: List[int], doc_histories: Dict):
    """
    Fall back to the existing single-doc QA tool.
    
    This is called when:
    - Question doesn't span multiple documents
    - Confidence is too low
    - Any error occurs in the multi-doc flow
    
    Returns:
        Dict with answer, has_contradiction, citations, tokens_input, tokens_output
    """
    try:
        print(f"[MULTI-DOC TOOL] Executing single-doc fallback", file=sys.stderr)
        
        # Import and use the existing single-doc tool
        from ..doc_qa_tool_structured import make_doc_qa_tool_structured
        
        single_doc_tool = make_doc_qa_tool_structured(
            chunk_db=chunk_db,
            document_ids=document_ids,
            doc_histories=doc_histories
        )
        
        # Invoke the tool - it returns a JSON string, we need to parse it
        result_str = single_doc_tool.invoke({"question": question})
        print(f"[MULTI-DOC TOOL] Single-doc fallback complete", file=sys.stderr)
        
        # Parse the JSON string and return as dict
        result_dict = json.loads(result_str)
        return result_dict
        
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
            "tokens_output": 0
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
