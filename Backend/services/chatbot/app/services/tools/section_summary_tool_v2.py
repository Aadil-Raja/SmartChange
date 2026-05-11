# app/services/tools/section_summary_tool_v2.py
"""
V2 section tools - list_document_sections_tool and generate_section_summary_tool
return structured JSON with citations included.
"""
from pydantic import BaseModel, Field
from langchain.tools import tool
from typing import List
import sys
import json
import re
from datetime import datetime

# Import debug logger
from app.utils.debug_logger import debug_log

# Re-use intent resolution from v1
from app.services.tools.section_summary_tool import (
    INTENT_PROMPT_MAP,
    _resolve_intent_prompts,
    _intent_label,
)
from shared.llm.utils import count_tokens


class ListSectionsToolArgs(BaseModel):
    pass


class GenerateSummaryToolArgs(BaseModel):
    section_title: str = Field(description="The exact section title to generate summary for. If user asks for multiple sections or all sections, pass any value here and set selection_type to 'many'.")
    user_intent: str = Field(
        default="summary",
        description="What the user wants from this section (e.g. 'summary', 'key takeaways', 'highlights')"
    )
    selection_type: str = Field(
        default="one",
        description="Pass 'one' if user selected a single specific section. Pass 'many' if user asked for multiple sections, all sections, or a range like 'days 5 to 12'."
    )


def make_list_sections_tool_v2(management_db, chunk_db, document_ids: List[int]):
    from shared.repos import documents_repo
    from shared.models.DocumentSection import DocumentSection

    @tool(args_schema=ListSectionsToolArgs, return_direct=True)
    def list_document_sections_tool() -> str:
        """List all sections/topics available in the selected document.

        ALWAYS use this tool FIRST whenever the user wants any kind of summary,
        overview, explanation, or topic breakdown of the document.

        IMPORTANT: After this tool returns, STOP immediately. Do NOT call doc_qa_tool
        or any other tool. Return this tool's output directly to the user as-is.
        If this tool returns a message about multiple documents or errors, return
        that message directly - do NOT try another tool.

        Returns a JSON string with keys: answer, has_contradiction, citations.
        """
        debug_log(f"\n[TOOL V2] list_document_sections_tool called", "TOOL V2")

        try:
            if len(document_ids) > 1:
                return json.dumps({
                    "answer": "Multiple documents are selected. Please select only one document to view its sections.",
                    "has_contradiction": False,
                    "citations": []
                })

            if not document_ids:
                return json.dumps({
                    "answer": "No document selected.",
                    "has_contradiction": False,
                    "citations": []
                })

            document_id = document_ids[0]
            doc = documents_repo.get_by_id(management_db, document_id)
            doc_title = doc.title if doc else "this document"
            cloudinary_url = doc.cloudinary_url if doc else None

            sections = management_db.query(DocumentSection).filter(
                DocumentSection.document_id == document_id
            ).order_by(DocumentSection.start_chunk_index).all()

            if not sections:
                return json.dumps({
                    "answer": f"No sections found in '{doc_title}'.",
                    "has_contradiction": False,
                    "citations": []
                })

            # Filter out blank/null section titles
            valid_sections = [s for s in sections if s.section_title and s.section_title.strip() and len(s.section_title.strip()) > 1]

            # Always use markdown list to ensure proper rendering
            section_list = "\n".join([f"- {s.section_title.strip()}" for s in valid_sections])

            answer = (
                f"**{doc_title}** contains the following {len(valid_sections)} sections:\n\n"
                f"{section_list}\n\n"
                "Which section would you like me to summarize?"
            )

            # Citations: one entry per section (doc-level, no page)
            citations = [{
                "doc_id": document_id,
                "doc_title": doc_title,
                "cloudinary_url": cloudinary_url,
                "page": None,
                "section": s.section_title,
                "snippet": None
            } for s in valid_sections]

            return json.dumps({
                "answer": answer,
                "has_contradiction": False,
                "citations": citations,
                "call_type": "list_sections",
            })

        except Exception as e:
            debug_log(f"[TOOL V2] list_sections error: {e}", "TOOL V2")
            import traceback
            traceback.print_exc(file=sys.stderr)
            return json.dumps({
                "answer": "Something went wrong while retrieving sections.",
                "has_contradiction": False,
                "citations": [],
                "call_type": "list_sections",
            })

    return list_document_sections_tool


def make_generate_summary_tool_v2(management_db, chunk_db, document_ids: List[int]):
    from shared.models.DocumentSection import DocumentSection
    from shared.models.Document import DocumentChunk
    from shared.llm import create_llm_provider
    from app.core.config import get_settings
    from difflib import get_close_matches

    settings = get_settings()

    # Pre-fetch section titles only for single-doc context so the LLM can resolve
    # partial/abbreviated names (e.g. "Q9" → "Q9. Is your software FBR compliant?")
    # For multi-doc, the tool itself rejects the call anyway, so no point injecting.
    try:
        if len(document_ids) == 1:
            _all_sections_for_desc = management_db.query(DocumentSection).filter(
                DocumentSection.document_id == document_ids[0]
            ).order_by(DocumentSection.start_chunk_index).all()
            _section_titles_list = "\n".join(f"  - {s.section_title}" for s in _all_sections_for_desc)
            _sections_hint = (
                f"\n\nAvailable section titles (use these EXACT names for section_title):\n"
                f"{_section_titles_list}\n\n"
                f"If the user writes a partial name or abbreviation (e.g. 'Q9', 'day 3', 'intro'), "
                f"match it to the closest title above and pass that exact full title."
            )
        else:
            _sections_hint = ""
    except Exception:
        _sections_hint = ""

    @tool(args_schema=GenerateSummaryToolArgs, return_direct=True)
    def generate_section_summary_tool(section_title: str, user_intent: str = "summary", selection_type: str = "one") -> str:
        """Generate or retrieve a summary for a specific document section.

        Use this tool when the user names a specific section and wants to know about it.

        IMPORTANT: After this tool returns, STOP immediately. Do NOT call any other
        tool after this one. Return this tool's output directly to the user as-is.

        CRITICAL - selection_type rules:
        - If the user mentions TWO OR MORE section names (e.g. "Day 1 and Day 7",
          "Day 1, Day 2, Day 3", "first and last day"), you MUST call this tool
          EXACTLY ONCE with selection_type='many'. Do NOT call it once per section.
        - If the user asks for "all sections", "everything", "all days", or any range
          like "days 5 to 12", call ONCE with selection_type='many'.
        - Only use selection_type='one' when the user names exactly ONE section.

        Examples:
        - "summarize Day 03" → call once, selection_type='one', section_title='Day 03'
        - "summarize Day 1 and Day 7" → call once, selection_type='many'
        - "summarize all days" → call once, selection_type='many'
        - "Day 5 to Day 8" → call once, selection_type='many'

        Returns a JSON string with keys: answer, has_contradiction, citations.
        """
        debug_log(f"\n[TOOL V2] generate_section_summary_tool called", "TOOL V2")
        debug_log(f"[TOOL V2] section_title={section_title}, user_intent={user_intent}, selection_type={selection_type}", "TOOL V2")

        # Handle multi-section request immediately
        if selection_type == "many":
            return json.dumps({
                "answer": "I can only summarize one section at a time. Please tell me the name of one specific section you'd like me to summarize.",
                "has_contradiction": False,
                "citations": []
            })

        try:
            if len(document_ids) > 1:
                return json.dumps({
                    "answer": "Multiple documents selected. Please select only one for section summaries.",
                    "has_contradiction": False,
                    "citations": []
                })

            if not document_ids:
                return json.dumps({
                    "answer": "No document selected.",
                    "has_contradiction": False,
                    "citations": []
                })

            document_id = document_ids[0]

            from shared.repos import documents_repo
            doc = documents_repo.get_by_id(management_db, document_id)
            doc_title = doc.title if doc else f"Document {document_id}"
            cloudinary_url = doc.cloudinary_url if doc else None

            # Fuzzy match section
            all_sections = management_db.query(DocumentSection).filter(
                DocumentSection.document_id == document_id
            ).order_by(DocumentSection.start_chunk_index).all()

            if not all_sections:
                return json.dumps({
                    "answer": "No sections found in this document.",
                    "has_contradiction": False,
                    "citations": []
                })

            section_titles = [s.section_title for s in all_sections]
            section = next((s for s in all_sections if s.section_title.lower() == section_title.lower()), None)

            if not section:
                import re
                query = section_title.lower().strip()

                # Strip leading number prefixes like "1.", "7.", "12." for cleaner matching
                def strip_prefix(t):
                    return re.sub(r'^\d+\.\s*', '', t).strip()

                stripped_titles = [strip_prefix(t) for t in section_titles]

                # Layer 1: substring match on stripped titles (handles "villans" → finds "Villains and Conflicts")
                # Check if query is a substring of any title or any title word starts with query
                section = next(
                    (all_sections[i] for i, t in enumerate(stripped_titles)
                     if query in t.lower() or t.lower().startswith(query)),
                    None
                )

                # Layer 2: fuzzy match on stripped titles (handles typos like "villans" vs "Villains")
                if not section:
                    matches = get_close_matches(query, [t.lower() for t in stripped_titles], n=1, cutoff=0.5)
                    if matches:
                        idx = [t.lower() for t in stripped_titles].index(matches[0])
                        section = all_sections[idx]

                # Layer 3: fuzzy match on full titles as last resort
                if not section:
                    matches = get_close_matches(section_title, section_titles, n=1, cutoff=0.5)
                    if matches:
                        section = next(s for s in all_sections if s.section_title == matches[0])

                if not section:
                    available = "\n".join([f"- {t}" for t in section_titles])
                    return json.dumps({
                        "answer": f"Section '{section_title}' not found.\n\nAvailable sections:\n{available}",
                        "has_contradiction": False,
                        "citations": []
                    })

            # Resolve intent
            intent_instruction, format_hint, intent_matched = _resolve_intent_prompts(user_intent)

            # Check cache
            normalized_intent = user_intent.lower().strip()
            cached_intent = getattr(section, 'summary_intent', 'summary') or 'summary'
            cache_ok = (
                section.summary and
                (normalized_intent == cached_intent or normalized_intent in ('summary', ''))
            )

            # Get chunks for citations regardless of cache
            chunks = chunk_db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id,
                DocumentChunk.chunk_index >= section.start_chunk_index,
                DocumentChunk.chunk_index <= section.end_chunk_index
            ).order_by(DocumentChunk.chunk_index).all()

            # Build a single citation covering the full section page range
            citations = []
            if chunks:
                start_page = getattr(chunks[0], 'start_page_num', None)
                end_page = getattr(chunks[-1], 'end_page_num', None) or getattr(chunks[-1], 'start_page_num', start_page)
                citations.append({
                    "doc_id": document_id,
                    "doc_title": doc_title,
                    "cloudinary_url": cloudinary_url,
                    "page": start_page,
                    "end_page": end_page,
                    "section": section.section_title,
                    "is_section_summary": True,
                    "snippet": chunks[0].text[:150].strip()
                })

            if cache_ok:
                answer = (
                    f"**{_intent_label(user_intent)} - {section.section_title}**\n\n"
                    f"{section.summary}"
                )
                return json.dumps({
                    "answer": answer,
                    "has_contradiction": False,
                    "citations": citations,
                    "tokens_input": 0,   # user message counted in chat_service_v2
                    "tokens_output": 0,
                    "call_type": "section_summary",
                })

            if not chunks:
                return json.dumps({
                    "answer": f"No content found for section '{section_title}'.",
                    "has_contradiction": False,
                    "citations": []
                })

            # Generate summary
            llm = create_llm_provider(
                llm_provider=settings.llm_provider,
                llm_model=settings.llm_model,
                google_api_key=settings.google_api_key,
                openai_api_key=settings.openai_api_key,
                max_output_tokens=settings.max_output_tokens
            )

            chunk_count = len(chunks)

            def build_prompt(section_name, content, target_words, existing_summary=""):
                base = f"You are summarizing a section titled '{section_name}'.\n\n"
                base += f"Task: {intent_instruction}\nFormat: {format_hint}\n"
                if not intent_matched:
                    base += f"User originally asked: \"{user_intent}\". Tailor accordingly.\n"
                base += f"Length: approximately {target_words} words.\n\n"
                if existing_summary:
                    base += f"Existing Summary:\n{existing_summary}\n\nNew Content:\n{content}\n\nUpdated Output:"
                else:
                    base += f"Content:\n{content}\n\nOutput:"
                return base

            if chunk_count <= 10:
                full_text = "\n\n".join([c.text for c in chunks])
                summary = llm.generate(build_prompt(section.section_title, full_text, chunk_count * 55))
                tokens_input = count_tokens(full_text)
            else:
                BATCH_SIZE = 10
                current_summary = ""
                tokens_input = 0
                for i in range(0, chunk_count, BATCH_SIZE):
                    batch = chunks[i:i + BATCH_SIZE]
                    batch_text = "\n\n".join([c.text for c in batch])
                    tokens_input += count_tokens(batch_text)
                    current_summary = llm.generate(
                        build_prompt(section.section_title, batch_text, (i + len(batch)) * 55, current_summary)
                    )
                summary = current_summary

            tokens_output = count_tokens(summary)

            # Cache
            section.summary = summary
            section.summary_generated_at = datetime.utcnow()
            section.summary_model = settings.llm_model
            section.summary_token_count = len(summary.split())
            if hasattr(section, 'summary_intent'):
                section.summary_intent = normalized_intent
            management_db.commit()

            answer = (
                f"**{_intent_label(user_intent)} - {section.section_title}**\n\n"
                f"{summary}"
            )

            return json.dumps({
                "answer": answer,
                "has_contradiction": False,
                "citations": citations,
                "tokens_input": tokens_input,
                "tokens_output": tokens_output,
                "call_type": "section_summary",
            })

        except Exception as e:
            debug_log(f"[TOOL V2] generate_summary error: {e}", "TOOL V2")
            import traceback
            traceback.print_exc(file=sys.stderr)
            return json.dumps({
                "answer": "Something went wrong while generating the summary.",
                "has_contradiction": False,
                "citations": [],
                "call_type": "section_summary",
            })

    # Append section titles to the tool description so the LLM can resolve partial names
    if _sections_hint:
        generate_section_summary_tool.description = generate_section_summary_tool.description + _sections_hint

    return generate_section_summary_tool
