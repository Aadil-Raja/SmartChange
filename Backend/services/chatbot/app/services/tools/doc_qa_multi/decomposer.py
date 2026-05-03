# app/services/tools/doc_qa_multi/decomposer.py
"""
Question decomposition logic - analyzes if a question spans multiple documents.
"""
import sys
from typing import Dict, List
from sqlalchemy.orm import Session
from .schemas import DecomposedQuestions


def decompose_question(
    question: str,
    document_ids: List[int],
    doc_histories: Dict[int, Dict],
    llm,
    management_db: Session = None,
    section_names_map: Dict[int, List[str]] = None  # ✅ NEW: Pre-fetched sections
) -> DecomposedQuestions:
    """
    Analyze if the question contains sub-questions targeting different documents.
    
    Args:
        question: User's question
        document_ids: List of active document IDs
        doc_histories: Dict mapping doc_id to {doc_title, summary, last_n_messages}
        llm: LLM instance with structured output support
        management_db: Database session for retrieving section names (optional)
        section_names_map: Pre-fetched section names (optional, for optimization)
        
    Returns:
        DecomposedQuestions object with analysis results
    """
    try:
        # Build document context with section names
        doc_context = _format_document_context(document_ids, doc_histories, management_db, section_names_map)
        
        # ✅ NEW: Log the document context being passed to decomposer
        print(f"\n[DECOMPOSER] Document context being passed to LLM:", file=sys.stderr)
        print(f"[DECOMPOSER] {'='*80}", file=sys.stderr)
        for line in doc_context.split('\n'):
            print(f"[DECOMPOSER] {line}", file=sys.stderr)
        print(f"[DECOMPOSER] {'='*80}\n", file=sys.stderr)
        
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
- **If confused or uncertain which document(s) contain the answer, include ALL relevant doc_ids** in that sub-question
- **Multiple documents per sub-question is ENCOURAGED when uncertain** - the retrieval system will use cosine similarity to find the best chunks
- Set confidence based on how clearly the split maps to distinct documents
- If unsure or if the question needs all documents together, set is_cross_doc=false
- Confidence should be 0.0-1.0 (0.0 = not confident at all, 1.0 = very confident)
- Use the section names to understand document structure and content

Examples of multi-doc sub-questions:
- "What is the insulation resistance value?" → If unsure which doc has this, use doc_ids=[39, 41, 45]
- "Tell me about the maintenance procedure" → Could be in multiple docs, use doc_ids=[39, 41]

Respond with:
- is_cross_doc: boolean indicating if question should be split
- confidence: float between 0.0 and 1.0
- sub_questions: list of objects with "question" (str) and "doc_ids" (list of ints, can be multiple)
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


def _format_document_context(
    document_ids: List[int], 
    doc_histories: Dict[int, Dict],
    management_db: Session = None,
    section_names_map: Dict[int, List[str]] = None  # ✅ NEW: Pre-fetched sections
) -> str:
    """
    Format document information for the prompt, including section names.
    
    Args:
        document_ids: List of document IDs
        doc_histories: Document histories with summaries
        management_db: Database session for retrieving sections
        section_names_map: Pre-fetched section names (optional, for optimization)
        
    Returns:
        Formatted string with document context
    """
    import random
    
    lines = []
    
    # ✅ OPTIMIZATION: Use pre-fetched sections if available, otherwise fetch in parallel
    if section_names_map is None and management_db:
        from concurrent.futures import ThreadPoolExecutor
        
        print(f"[DECOMPOSER] Fetching section names for {len(document_ids)} docs in parallel", file=sys.stderr)
        
        section_names_map = {}
        with ThreadPoolExecutor(max_workers=len(document_ids)) as executor:
            # Submit all section retrieval tasks simultaneously
            futures = {doc_id: executor.submit(_get_section_names, management_db, doc_id) 
                      for doc_id in document_ids}
            
            # Collect results
            for doc_id, future in futures.items():
                try:
                    section_names_map[doc_id] = future.result()
                except Exception as e:
                    print(f"[DECOMPOSER] Failed to get sections for doc {doc_id}: {e}", file=sys.stderr)
                    section_names_map[doc_id] = []
        
        print(f"[DECOMPOSER] Section names fetched in parallel", file=sys.stderr)
    elif section_names_map:
        print(f"[DECOMPOSER] Using pre-fetched section names", file=sys.stderr)
    
    for doc_id in document_ids:
        # Get document title
        doc_title = f'Document {doc_id}'
        if doc_id in doc_histories:
            doc_title = doc_histories[doc_id].get('doc_title', doc_title)
        
        lines.append(f"- Doc {doc_id}: {doc_title}")
        
        # Add summary if available
        if doc_id in doc_histories:
            summary = doc_histories[doc_id].get('summary')
            if summary:
                summary_preview = summary[:200] + "..." if len(summary) > 200 else summary
                lines.append(f"  Summary: {summary_preview}")
        
        # Add section names if available
        if section_names_map and doc_id in section_names_map and section_names_map[doc_id]:
            section_names = section_names_map[doc_id]
            
            # ✅ NEW: Randomly sample 10 sections if more than 10
            if len(section_names) > 10:
                sampled_sections = random.sample(section_names, 10)
                sections_str = ", ".join(sampled_sections)
                sections_str += f" ... (randomly sampled 10 from {len(section_names)} total sections)"
            else:
                sections_str = ", ".join(section_names)
            
            lines.append(f"  Sections: {sections_str}")
        
        # If no summary and no sections, indicate no info available
        if doc_id not in doc_histories and (not section_names_map or doc_id not in section_names_map):
            lines.append(f"  (No information available)")
    
    return "\n".join(lines)


def _get_section_names(db: Session, document_id: int) -> List[str]:
    """
    Retrieve section names for a document.
    
    Args:
        db: Database session
        document_id: Document ID
        
    Returns:
        List of section names
    """
    try:
        from shared.models import DocumentSection
        
        sections = db.query(DocumentSection.section_title).filter(
            DocumentSection.document_id == document_id
        ).order_by(DocumentSection.start_chunk_index).all()
        
        # Extract section titles from query result
        section_titles = [s[0] for s in sections if s[0]]
        
        print(f"[DECOMPOSER] Retrieved {len(section_titles)} sections for doc {document_id}", file=sys.stderr)
        return section_titles
        
    except Exception as e:
        print(f"[DECOMPOSER] Error retrieving sections: {e}", file=sys.stderr)
        return []
