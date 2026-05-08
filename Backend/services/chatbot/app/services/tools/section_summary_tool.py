# app/services/tools/section_summary_tool.py
from pydantic import BaseModel, Field
from langchain.tools import tool
import sys
from datetime import datetime
from typing import List

# Import debug logger
from app.utils.debug_logger import debug_log


class ListSectionsToolArgs(BaseModel):
    """No arguments needed - uses document from session"""
    pass


class GenerateSummaryToolArgs(BaseModel):
    section_title: str = Field(description="The exact section title to generate summary for")
    user_intent: str = Field(
        default="summary",
        description=(
            "What the user wants from this section. Examples: "
            "'main topics', 'key takeaways', 'brief overview', 'detailed explanation', "
            "'simple explanation', 'bullet points', 'summary', 'what does this cover', "
            "'important points', 'highlights'. Infer from the user's original message."
        )
    )


# Maps user_intent keywords -> (prompt instruction, format hint)
INTENT_PROMPT_MAP = {
    "main topics":          ("List and briefly explain the main topics covered.",                    "Use a numbered or bulleted list of topics with a 1-2 sentence explanation each."),
    "key takeaways":        ("Extract the most important takeaways a reader should remember.",       "Use a concise bulleted list. Each point should be a single clear sentence."),
    "brief overview":       ("Give a short high-level overview.",                                    "Keep it to 3-5 sentences. No bullet points."),
    "highlights":           ("Highlight the most notable or interesting points.",                    "Use bullet points. Focus on what stands out."),
    "simple explanation":   ("Explain this section as if to someone unfamiliar with the topic.",     "Use plain language. Avoid jargon. Write in clear paragraphs."),
    "detailed explanation": ("Provide a thorough and detailed explanation of all content.",          "Write in well-structured paragraphs. Cover all sub-points."),
    "bullet points":        ("Summarize the content in bullet point form.",                          "Use bullet points only. Each point should be concise."),
    "summary":              ("Provide a comprehensive summary capturing all main points.",           "Write in clear paragraphs."),
}


def _resolve_intent_prompts(user_intent: str) -> tuple[str, str, bool]:
    """
    Fuzzy-match user_intent to a known intent key.
    Returns (instruction, format_hint, matched).
    If no match found, returns generic summary defaults with matched=False
    so the caller can inject the raw user_intent into the prompt instead.
    """
    from difflib import get_close_matches
    intent_lower = user_intent.lower().strip()

    # Exact match first
    if intent_lower in INTENT_PROMPT_MAP:
        return (*INTENT_PROMPT_MAP[intent_lower], True)

    # Fuzzy match
    matches = get_close_matches(intent_lower, INTENT_PROMPT_MAP.keys(), n=1, cutoff=0.45)
    if matches:
        return (*INTENT_PROMPT_MAP[matches[0]], True)

    # Keyword scan fallback
    for key in INTENT_PROMPT_MAP:
        if any(word in intent_lower for word in key.split()):
            return (*INTENT_PROMPT_MAP[key], True)

    # No match - return generic defaults, signal caller to inject raw intent
    return (*INTENT_PROMPT_MAP["summary"], False)


def make_list_sections_tool(management_db, chunk_db, document_ids: List[int]):
    """
    Returns a LangChain tool that lists available sections for summarization.
    """
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../../..'))

    from shared.repos import documents_repo
    from shared.models.DocumentSection import DocumentSection

    @tool(args_schema=ListSectionsToolArgs, return_direct=True)
    def list_document_sections_tool() -> str:
        """List all sections/topics available in the selected document.

        ALWAYS use this tool FIRST whenever the user wants any kind of summary,
        overview, explanation, or topic breakdown of the document - even if they
        mention a specific intent like 'main topics', 'key takeaways', 'highlights',
        or 'brief overview'. The user must select a section before any summary can
        be generated. Never skip this step and go directly to generate_section_summary_tool
        unless the user has already been shown the section list and explicitly named a section.

        Use this tool when the user says things like:
        - "summarize", "summarize this", "summarize the document"
        - "main topics", "what are the main topics", "list the topics"
        - "key takeaways", "what are the key takeaways"
        - "give me an overview", "brief overview", "quick overview"
        - "highlights", "what are the highlights"
        - "explain this document", "explain everything", "walk me through this"
        - "what does this cover", "what's in this", "what is this about"
        - "give me a breakdown", "break it down", "break this down"
        - "show me the sections", "what are the sections", "table of contents"
        - "what are the chapters", "list chapters", "show chapters"
        - "give me an outline", "outline this"
        - "summarize everything", "summarize all sections"
        - "important points", "what are the important points"
        - "tell me about this document", "what can I learn from this"
        - Roman Urdu: "khulasa", "topics batao", "main points", "mukhtar maloomat",
          "is document mein kya hai", "sections dikhao", "overview do"

        CALL THIS TOOL ALONE. Do not invoke any other tool in the same step.
        Wait for the user to select a section, then call generate_section_summary_tool.

        DO NOT use for specific factual questions about content (e.g. "what is X", "how does Y work").
        """
        debug_log(f"\n[TOOL CALLED] list_document_sections_tool", "TOOL")
        debug_log(f"Document IDs: {document_ids}", "TOOL")

        try:
            if len(document_ids) > 1:
                return "Multiple documents are selected. Please select only one document to view its sections."

            if len(document_ids) == 0:
                return "No document selected. Please select a document to view its sections."

            document_id = document_ids[0]

            debug_log(f"Querying management_db for document_id={document_id}", "TOOL")

            doc = documents_repo.get_by_id(management_db, document_id)
            debug_log(f"Document retrieved: {doc}", "TOOL")
            debug_log(f"Document title: {doc.title if doc else 'None'}", "TOOL")

            doc_name = doc.title if doc else "this document"

            debug_log(f"Querying sections for document_id={document_id}", "TOOL")
            sections = management_db.query(DocumentSection).filter(
                DocumentSection.document_id == document_id
            ).order_by(DocumentSection.start_chunk_index).all()

            debug_log(f"Sections query returned {len(sections)} results", "TOOL")

            if not sections:
                return f"No sections found in '{doc_name}'. The document may not have been processed with section detection."

            debug_log(f"Found {len(sections)} sections", "TOOL")

            response = f"**{doc_name}** contains the following {len(sections)} sections:\n\n"
            for i, section in enumerate(sections, 1):
                response += f"{i}. {section.section_title}\n"

            response += "\nWhich section would you like me to summarize? You can reply with the section name or its number."

            return response

        except Exception as e:
            debug_log(f"Error: {e}", "TOOL")
            import traceback
            traceback.print_exc(file=sys.stderr)
            return "Something went wrong while retrieving sections. Please try again or contact support if the issue persists."

    return list_document_sections_tool


def make_generate_summary_tool(management_db, chunk_db, document_ids: List[int]):
    """
    Returns a LangChain tool that generates or retrieves a summary for a specific section.
    Uses fuzzy matching and iterative summarization for large sections.
    Adapts output style based on user_intent.
    """
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../../..'))

    from shared.models.DocumentSection import DocumentSection
    from shared.models.Document import DocumentChunk
    from shared.llm import create_llm_provider
    from app.core.config import get_settings
    from difflib import get_close_matches
    from datetime import datetime

    settings = get_settings()

    @tool(args_schema=GenerateSummaryToolArgs)
    def generate_section_summary_tool(section_title: str, user_intent: str = "summary") -> str:
        """Generate or retrieve a summary for a specific document section.

        Use this tool when the user:
        - Names or refers to a specific section and wants to know about it
        - Asks to summarize, explain, break down, or describe a section
        - Wants key takeaways, main topics, highlights, or an overview of a section
        - Says things like: "tell me about [section]", "what does [section] cover",
          "give me the highlights of [section]", "explain [section] to me",
          "what are the important points in [section]", "summarize [section]"

        Always pass user_intent to reflect what the user actually asked for
        (e.g. 'main topics', 'key takeaways', 'brief overview', 'simple explanation').

        IMPORTANT - Roman Urdu handling: users may write in Roman Urdu (Urdu written
        in English letters, e.g. "mujhe is section ka khulasa chahiye", "key points
        batao", "mukhtar maloomat do"). Before passing user_intent, translate the
        user's message to English and extract the intent from the translated version.
        For example: "khulasa" -> "summary", "key points batao" -> "key takeaways",
        "aasan alfaz mein" -> "simple explanation", "mukhtar maloomat" -> "highlights".
        """
        debug_log(f"\n[TOOL CALLED] generate_section_summary_tool", "TOOL")
        debug_log(f"Document IDs: {document_ids}", "TOOL")
        debug_log(f"Section Title: {section_title}", "TOOL")
        debug_log(f"User Intent: {user_intent}", "TOOL")

        try:
            if len(document_ids) > 1:
                return "Multiple documents are selected. Please select only one document to generate section summaries."

            if len(document_ids) == 0:
                return "No document selected. Please select a document to generate section summaries."

            document_id = document_ids[0]

            # Step 1: Get all sections for fuzzy matching
            all_sections = management_db.query(DocumentSection).filter(
                DocumentSection.document_id == document_id
            ).order_by(DocumentSection.start_chunk_index).all()

            if not all_sections:
                return "No sections found in this document."

            # Step 2: Fuzzy match section title
            section_titles = [s.section_title for s in all_sections]
            section = next((s for s in all_sections if s.section_title.lower() == section_title.lower()), None)

            if not section:
                matches = get_close_matches(section_title, section_titles, n=1, cutoff=0.6)
                if matches:
                    matched_title = matches[0]
                    section = next(s for s in all_sections if s.section_title == matched_title)
                    debug_log(f"Fuzzy matched '{section_title}' -> '{matched_title}'", "TOOL")
                else:
                    return (
                        f"Section '{section_title}' was not found.\n\n"
                        f"Available sections:\n" +
                        "\n".join([f"{i+1}. {t}" for i, t in enumerate(section_titles)])
                    )

            debug_log(f"Found section: {section.section_title} ({section.chunk_count} chunks)", "TOOL")

            # Step 3: Resolve intent -> prompt instructions
            intent_instruction, format_hint, intent_matched = _resolve_intent_prompts(user_intent)
            debug_log(f"Resolved intent '{user_intent}' -> matched={intent_matched}, instruction: {intent_instruction[:60]}...", "TOOL")

            # Step 4: Check cache - only reuse if intent matches or is a generic summary
            normalized_intent = user_intent.lower().strip()
            cached_intent = getattr(section, 'summary_intent', 'summary') or 'summary'
            cache_is_compatible = (
                section.summary and
                (normalized_intent == cached_intent or normalized_intent in ('summary', ''))
            )

            if cache_is_compatible:
                debug_log(f"Using cached summary (intent: {cached_intent})", "TOOL")
                response = f"**{_intent_label(user_intent)} - {section.section_title}**\n\n"
                response += section.summary
                response += f"\n\n_[Cached · {section.summary_generated_at.strftime('%Y-%m-%d %H:%M')}]_"
                return response

            # Step 5: Get chunks
            chunks = chunk_db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id,
                DocumentChunk.chunk_index >= section.start_chunk_index,
                DocumentChunk.chunk_index <= section.end_chunk_index
            ).order_by(DocumentChunk.chunk_index).all()

            debug_log(f"Retrieved {len(chunks)} chunks", "TOOL")

            if not chunks:
                return f"No content found for section '{section_title}'."

            # Step 6: Create LLM
            llm = create_llm_provider(
                llm_provider=settings.llm_provider,
                llm_model=settings.llm_model,
                google_api_key=settings.google_api_key,
                openai_api_key=settings.openai_api_key,
                max_output_tokens=settings.max_output_tokens
            )

            chunk_count = len(chunks)

            def build_prompt(section_name: str, content: str, target_words: int, existing_summary: str = "") -> str:
                base = f"You are summarizing a section titled '{section_name}'.\n\n"
                base += f"Task: {intent_instruction}\n"
                base += f"Format: {format_hint}\n"
                if not intent_matched:
                    base += f"Additional context - the user originally asked: \"{user_intent}\". Tailor your response to best fulfill this request.\n"
                base += f"Length: approximately {target_words} words.\n\n"
                if existing_summary:
                    base += f"Existing Summary So Far:\n{existing_summary}\n\nNew Content to Integrate:\n{content}\n\nUpdated Output:"
                else:
                    base += f"Content:\n{content}\n\nOutput:"
                return base

            # Step 7: Generate - small or large section
            if chunk_count <= 10:
                debug_log(f"Using direct summarization (<= 10 chunks)", "TOOL")
                full_text = "\n\n".join([chunk.text for chunk in chunks])
                target_words = chunk_count * 55
                prompt = build_prompt(section.section_title, full_text, target_words)
                summary = llm.generate(prompt)

            else:
                debug_log(f"Using iterative summarization (> 10 chunks)", "TOOL")
                BATCH_SIZE = 10
                current_summary = ""

                for i in range(0, chunk_count, BATCH_SIZE):
                    batch = chunks[i:i + BATCH_SIZE]
                    batch_text = "\n\n".join([chunk.text for chunk in batch])
                    batch_num = (i // BATCH_SIZE) + 1
                    total_batches = (chunk_count + BATCH_SIZE - 1) // BATCH_SIZE
                    target_words = (i + len(batch)) * 55

                    debug_log(f"Processing batch {batch_num}/{total_batches} ({len(batch)} chunks)", "TOOL")

                    prompt = build_prompt(
                        section.section_title,
                        batch_text,
                        target_words,
                        existing_summary=current_summary
                    )
                    current_summary = llm.generate(prompt)
                    debug_log(f"Batch {batch_num} output: {len(current_summary.split())} words", "TOOL")

                summary = current_summary

            debug_log(f"Summary generated ({len(summary.split())} words)", "TOOL")

            # Step 8: Cache to DB
            section.summary = summary
            section.summary_generated_at = datetime.utcnow()
            section.summary_model = settings.llm_model
            section.summary_token_count = len(summary.split())
            if hasattr(section, 'summary_intent'):
                section.summary_intent = normalized_intent
            management_db.commit()
            management_db.refresh(section)

            debug_log(f"Summary cached", "TOOL")

            # Step 9: Return
            response = f"**{_intent_label(user_intent)} - {section.section_title}**\n\n"
            response += summary
            response += f"\n\n_[{len(chunks)} chunks · {len(summary.split())} words]_"

            return response

        except Exception as e:
            debug_log(f"Error: {e}", "TOOL")
            import traceback
            traceback.print_exc(file=sys.stderr)
            return "Something went wrong while generating the summary. Please try again or contact support if the issue persists."

    return generate_section_summary_tool


def _intent_label(user_intent: str) -> str:
    """Convert raw intent string into a readable heading label."""
    labels = {
        "main topics":          "Main Topics",
        "key takeaways":        "Key Takeaways",
        "brief overview":       "Brief Overview",
        "highlights":           "Highlights",
        "simple explanation":   "Simple Explanation",
        "detailed explanation": "Detailed Explanation",
        "bullet points":        "Summary (Bullet Points)",
        "summary":              "Summary",
    }
    return labels.get(user_intent.lower().strip(), "Summary")