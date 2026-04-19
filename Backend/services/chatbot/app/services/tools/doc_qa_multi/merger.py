# app/services/tools/doc_qa_multi/merger.py
"""
Answer merging logic - combines multiple sub-answers into one coherent response.
"""
import sys
from typing import List
from .schemas import SubAnswer, MergedAnswer


def merge_answers(
    sub_answers: List[SubAnswer],
    original_question: str,
    llm
) -> MergedAnswer:
    """
    Merge multiple sub-answers into one unified response.
    
    Args:
        sub_answers: List of SubAnswer objects to merge
        original_question: The original user question
        llm: LLM instance with structured output support
        
    Returns:
        MergedAnswer object with merged response
    """
    try:
        print(f"[MERGER] Merging {len(sub_answers)} sub-answers", file=sys.stderr)
        
        # Format sub-answers for the prompt
        formatted_answers = _format_sub_answers(sub_answers)
        
        # Build merger prompt
        prompt = f"""Original question: "{original_question}"

Sub-answers:

{formatted_answers}

Instructions:
- Write ONE unified, coherent answer to the original question
- Order by importance (most specific/factual information first, not chronological)
- If any sub-answer has has_contradiction=true, preserve that flag in your response
- If answers from different documents contradict each other on the same factual point, note it explicitly using this format:
  "Note: Documents contradict each other — [Doc A] states X while [Doc B] states Y."
- Handle overlapping information by picking the more detailed answer and not repeating
- Integrate all information smoothly into a natural-sounding response
- Do NOT mention "sub-answer" or "sub-question" in your response - write as if answering directly

FORMATTING INSTRUCTIONS (CRITICAL):
- Use **bold** for important terms, names, titles, key concepts, and numbers
- When listing items (numbered or bulleted), put EACH item on a SEPARATE line
- Use proper line breaks between different topics or sections
- Format numbered lists like this:
  1. **First Item** - description
  2. **Second Item** - description
  3. **Third Item** - description
- Format bullet lists like this:
  - **Point One**: details
  - **Point Two**: details
- Add blank lines between different topics for better readability
- Bold document titles, project names, company names, dates, and statistics

EXAMPLES OF GOOD FORMATTING:

Example 1 (Skills):
Aadil Raja possesses a diverse skill set including:
- **Backend Development**: FastAPI, Node.js
- **Full-Stack Development**: React.js, Blazor
- **Workflow Automation**: n8n, Pipedrive
- **LLM Applications**: RAG systems, chatbots
- **Deployment & DevOps**: Azure, Docker

Example 2 (Book Order):
The Harry Potter series consists of **7 books** in the following order:

1. **Harry Potter and the Philosopher's Stone**
2. **Harry Potter and the Chamber of Secrets**
3. **Harry Potter and the Prisoner of Azkaban**
4. **Harry Potter and the Goblet of Fire**
5. **Harry Potter and the Order of the Phoenix**
6. **Harry Potter and the Half-Blood Prince**
7. **Harry Potter and the Deathly Hallows**

Example 3 (Tournament Format):
The **Pakistan Super League (PSL)** follows this structure:

**Group Stage:**
- Double round-robin format (each team plays every other team)
- **2 points** for a win, **1 point** for no result
- Top **4 teams** advance to playoffs

**Playoffs:**
1. **Qualifier**: 1st place vs 2nd place
2. **Eliminator 1**: 3rd place vs 4th place
3. **Eliminator 2**: Loser of Qualifier vs Winner of Eliminator 1
4. **Final**: Winner of Qualifier vs Winner of Eliminator 2

All matches are played in **T20 format** (20 overs per team).

Respond with a JSON-compatible structure containing:
- answer: string (the unified, well-formatted answer with markdown bold and line breaks)
- has_contradiction: boolean (true if any contradictions found)
- citations: list of citation objects (will be processed separately)
- tokens_input: 0 (will be calculated separately)
- tokens_output: 0 (will be calculated separately)
"""
        
        # Use LangChain structured output with function_calling method for OpenAI compatibility
        try:
            print(f"[MERGER] Calling LLM with structured output...", file=sys.stderr)
            langchain_model = llm.get_langchain_model()
            structured_llm = langchain_model.with_structured_output(MergedAnswer, method="function_calling")
            result: MergedAnswer = structured_llm.invoke(prompt)
        except Exception as e:
            print(f"[MERGER] Structured output failed: {e}, trying generate_json...", file=sys.stderr)
            # Fallback to generate_json
            result_dict = llm.generate_json(prompt)
            result = MergedAnswer(**result_dict)
        
        # Post-process: deduplicate citations
        all_citations = []
        for sub_answer in sub_answers:
            all_citations.extend(sub_answer.citations)
        
        result.citations = _dedup_citations(all_citations)
        
        # Post-process: aggregate token counts
        result.tokens_input = sum(sa.tokens_input for sa in sub_answers)
        result.tokens_output = sum(sa.tokens_output for sa in sub_answers)
        
        # Add merger's own token usage (estimate based on prompt/response length)
        merger_input_tokens = len(prompt.split()) * 1.3  # Rough estimate
        merger_output_tokens = len(result.answer.split()) * 1.3
        result.tokens_input += int(merger_input_tokens)
        result.tokens_output += int(merger_output_tokens)
        
        # Post-process: add error notes from failed sub-answers
        failed_notes = [sa.error_note for sa in sub_answers if sa.failed and sa.error_note]
        if failed_notes:
            result.answer += "\n\n" + "\n".join(f"Note: {note}" for note in failed_notes)
        
        print(f"[MERGER] Merge complete, {len(result.citations)} citations, has_contradiction={result.has_contradiction}", file=sys.stderr)
        return result
        
    except Exception as e:
        print(f"[MERGER] Error merging answers: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        # Return a fallback merged answer
        return _create_fallback_merged_answer(sub_answers, original_question)


def _format_sub_answers(sub_answers: List[SubAnswer]) -> str:
    """Format sub-answers for the merger prompt."""
    lines = []
    
    for i, sa in enumerate(sub_answers, 1):
        if sa.failed:
            lines.append(f"[Sub-answer {i}] FAILED")
            lines.append(f"Q: {sa.question}")
            lines.append(f"Error: {sa.error_note}")
            lines.append("")
        else:
            # Get document titles from citations if available
            doc_titles = set()
            for citation in sa.citations:
                if 'doc_title' in citation:
                    doc_titles.add(f"{citation['doc_id']}: {citation['doc_title']}")
            
            doc_info = ", ".join(doc_titles) if doc_titles else f"Documents {sa.doc_ids}"
            
            lines.append(f"[From {doc_info}]")
            lines.append(f"Q: {sa.question}")
            lines.append(f"A: {sa.answer}")
            if sa.has_contradiction:
                lines.append("⚠️ This answer contains contradictions")
            lines.append(f"Citations: {len(sa.citations)} sources")
            lines.append("")
    
    return "\n".join(lines)


def _dedup_citations(citations: List[dict]) -> List[dict]:
    """
    Deduplicate citations by (doc_id, page, section) tuple.
    
    Args:
        citations: List of citation dictionaries
        
    Returns:
        Deduplicated list of citations
    """
    seen = set()
    result = []
    
    for citation in citations:
        # Create unique key from doc_id, page, and section
        key = (
            citation.get('doc_id'),
            citation.get('page'),
            citation.get('section')
        )
        
        if key not in seen:
            seen.add(key)
            result.append(citation)
    
    return result


def _create_fallback_merged_answer(sub_answers: List[SubAnswer], original_question: str) -> MergedAnswer:
    """Create a simple fallback merged answer when LLM merge fails."""
    # Concatenate all successful answers
    answer_parts = []
    all_citations = []
    has_any_contradiction = False
    total_input_tokens = 0
    total_output_tokens = 0
    
    for sa in sub_answers:
        if not sa.failed and sa.answer:
            answer_parts.append(sa.answer)
            all_citations.extend(sa.citations)
            if sa.has_contradiction:
                has_any_contradiction = True
            total_input_tokens += sa.tokens_input
            total_output_tokens += sa.tokens_output
    
    # Add error notes
    failed_notes = [sa.error_note for sa in sub_answers if sa.failed and sa.error_note]
    if failed_notes:
        answer_parts.extend([f"Note: {note}" for note in failed_notes])
    
    return MergedAnswer(
        answer=" ".join(answer_parts) if answer_parts else "Unable to generate answer.",
        has_contradiction=has_any_contradiction,
        citations=_dedup_citations(all_citations),
        tokens_input=total_input_tokens,
        tokens_output=total_output_tokens
    )
