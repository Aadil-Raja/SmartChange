# app/services/tools/doc_qa_multi/decomposer.py
"""
Question decomposition logic - analyzes if a question spans multiple documents.
"""
import sys
from typing import Dict, List
from .schemas import DecomposedQuestions


def decompose_question(
    question: str,
    document_ids: List[int],
    doc_histories: Dict[int, Dict],
    llm
) -> DecomposedQuestions:
    """
    Analyze if the question contains sub-questions targeting different documents.
    
    Args:
        question: User's question
        document_ids: List of active document IDs
        doc_histories: Dict mapping doc_id to {doc_title, summary, last_n_messages}
        llm: LLM instance with structured output support
        
    Returns:
        DecomposedQuestions object with analysis results
    """
    try:
        # Build document context
        doc_context = _format_document_context(document_ids, doc_histories)
        
        # Create decomposition prompt
        prompt = f"""You have access to these documents:
{doc_context}

User question: "{question}"

Analyze if this question contains sub-questions targeting different documents.

Examples of when NOT to split:
- "What are the key points in both documents?" → needs both documents together for comparison
- "Compare the tech stacks in these two documents" → comparison requires both documents simultaneously
- "How do these documents relate to each other?" → needs holistic view of all documents

Examples of when to split:
- "What is Aadil's GPA and what are the PSL team names?" → clearly separate topics from different documents
- "Summarize Aadil's projects and list the PSL 2024 standings" → no overlap between sub-questions
- "Tell me about the tournament format and Aadil's work experience" → distinct topics from distinct documents

Instructions:
- Only split when confident that different parts target different documents
- A sub-question may still span multiple doc IDs if needed
- Set confidence based on how clearly the split maps to distinct documents
- If unsure or if the question needs all documents together, set is_cross_doc=false
- Confidence should be 0.0-1.0 (0.0 = not confident at all, 1.0 = very confident)

Respond with:
- is_cross_doc: boolean indicating if question should be split
- confidence: float between 0.0 and 1.0
- sub_questions: list of objects with "question" (str) and "doc_ids" (list of ints)
"""
        
        # Use LangChain structured output with function_calling method for OpenAI compatibility
        try:
            print(f"[DECOMPOSER] Calling LLM with structured output...", file=sys.stderr)
            langchain_model = llm.get_langchain_model()
            structured_llm = langchain_model.with_structured_output(DecomposedQuestions, method="function_calling")
            result: DecomposedQuestions = structured_llm.invoke(prompt)
            print(f"[DECOMPOSER] Result: is_cross_doc={result.is_cross_doc}, confidence={result.confidence}, sub_questions={len(result.sub_questions)}", file=sys.stderr)
            return result
        except Exception as e:
            print(f"[DECOMPOSER] Structured output failed: {e}, trying generate_json...", file=sys.stderr)
            # Fallback to generate_json
            result_dict = llm.generate_json(prompt)
            result = DecomposedQuestions(**result_dict)
            print(f"[DECOMPOSER] Fallback result: is_cross_doc={result.is_cross_doc}, confidence={result.confidence}", file=sys.stderr)
            return result
            
    except Exception as e:
        # On any error, return safe default (don't split)
        print(f"[DECOMPOSER] Error: {e}, returning safe default", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return DecomposedQuestions(
            is_cross_doc=False,
            confidence=0.0,
            sub_questions=[]
        )


def _format_document_context(document_ids: List[int], doc_histories: Dict[int, Dict]) -> str:
    """Format document information for the prompt."""
    lines = []
    for doc_id in document_ids:
        if doc_id in doc_histories:
            doc_data = doc_histories[doc_id]
            doc_title = doc_data.get('doc_title', f'Document {doc_id}')
            summary = doc_data.get('summary', 'No summary available')
            
            lines.append(f"- Doc {doc_id}: {doc_title}")
            if summary:
                # Truncate summary if too long
                summary_preview = summary[:200] + "..." if len(summary) > 200 else summary
                lines.append(f"  Summary: {summary_preview}")
        else:
            lines.append(f"- Doc {doc_id}: (No information available)")
    
    return "\n".join(lines)
