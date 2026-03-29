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
from datetime import datetime

# Re-use intent resolution from v1
from app.services.tools.section_summary_tool import (
    INTENT_PROMPT_MAP,
    _resolve_intent_prompts,
    _intent_label,
)


class ListSectionsToolArgs(BaseModel):
    pass


class GenerateSummaryToolArgs(BaseModel):
    section_title: str = Field(description="The exact section title to generate summary for")
    user_intent: str = Field(
        default="summary",
        description="What the user wants from this section (e.g. 'summary', 'key takeaways', 'highlights')"
    )


def make_list_sections_tool_v2(management_db, chunk_db, document_ids: List[int]):
    from shared.repos import documents_repo
    from shared.models.DocumentSection import DocumentSection

    @tool(args_schema=ListSectionsToolArgs, return_direct=True)
    def list_document_sections_tool() -> str:
        """List all sections/topics available in the selected document.

        ALWAYS use this tool FIRST whenever the user wants any kind of summary,
        overview, explanation, or topic breakdown of the document.

        Returns a JSON string with keys: sections (list), doc_title, citations.
        IMPORTANT: Return the tool output EXACTLY as-is.
        """
        print(f"\n[TOOL V2] list_document_sections_tool called", file=sys.stderr)

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

            sections = management_db.query(DocumentSection).filter(
                DocumentSection.document_id == document_id
            ).order_by(DocumentSection.start_chunk_index).all()

            if not sections:
                return json.dumps({
                    "answer": f"No sections found in '{doc_title}'.",
                    "has_contradiction": False,
                    "citations": []
                })

            section_list = "\n".join([f"{i+1}. {s.section_title}" for i, s in enumerate(sections)])
            answer = (
                f"**{doc_title}** contains the following {len(sections)} sections:\n\n"
                f"{section_list}\n\n"
                "Which section would you like me to summarize?"
            )

            # Citations: one entry per section (doc-level, no page)
            citations = [{
                "doc_id": document_id,
                "doc_title": doc_title,
                "page": None,
                "section": s.section_title,
                "snippet": None
            } for s in sections]

            return json.dumps({
                "answer": answer,
                "has_contradiction": False,
                "citations": citations
            })

        except Exception as e:
            print(f"[TOOL V2] list_sections error: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return json.dumps({
                "answer": "Something went wrong while retrieving sections.",
                "has_contradiction": False,
                "citations": []
            })

    return list_document_sections_tool


def make_generate_summary_tool_v2(management_db, chunk_db, document_ids: List[int]):
    from shared.models.DocumentSection import DocumentSection
    from shared.models.Document import DocumentChunk
    from shared.llm import create_llm_provider
    from app.core.config import get_settings
    from difflib import get_close_matches

    settings = get_settings()

    @tool(args_schema=GenerateSummaryToolArgs)
    def generate_section_summary_tool(section_title: str, user_intent: str = "summary") -> str:
        """Generate or retrieve a summary for a specific document section.

        Use this tool when the user names a specific section and wants to know about it.
        Returns a JSON string with keys: answer, has_contradiction, citations.
        IMPORTANT: Return the tool output EXACTLY as-is.
        """
        print(f"\n[TOOL V2] generate_section_summary_tool called", file=sys.stderr)
        print(f"[TOOL V2] section_title={section_title}, user_intent={user_intent}", file=sys.stderr)

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
                matches = get_close_matches(section_title, section_titles, n=1, cutoff=0.6)
                if matches:
                    section = next(s for s in all_sections if s.section_title == matches[0])
                else:
                    available = "\n".join([f"{i+1}. {t}" for i, t in enumerate(section_titles)])
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

            # Build citations from chunks
            citations = []
            seen_pages = set()
            for c in chunks:
                page = getattr(c, 'start_page_num', None)
                key = (document_id, page, section.section_title)
                if key not in seen_pages:
                    seen_pages.add(key)
                    citations.append({
                        "doc_id": document_id,
                        "doc_title": doc_title,
                        "page": page,
                        "section": section.section_title,
                        "snippet": c.text[:150].strip()
                    })

            if cache_ok:
                answer = (
                    f"**{_intent_label(user_intent)} - {section.section_title}**\n\n"
                    f"{section.summary}\n\n"
                    f"_[Cached · {section.summary_generated_at.strftime('%Y-%m-%d %H:%M')}]_"
                )
                return json.dumps({
                    "answer": answer,
                    "has_contradiction": False,
                    "citations": citations
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
                openai_api_key=settings.openai_api_key
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
            else:
                BATCH_SIZE = 10
                current_summary = ""
                for i in range(0, chunk_count, BATCH_SIZE):
                    batch = chunks[i:i + BATCH_SIZE]
                    batch_text = "\n\n".join([c.text for c in batch])
                    current_summary = llm.generate(
                        build_prompt(section.section_title, batch_text, (i + len(batch)) * 55, current_summary)
                    )
                summary = current_summary

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
                f"{summary}\n\n"
                f"_[{chunk_count} chunks · {len(summary.split())} words]_"
            )

            return json.dumps({
                "answer": answer,
                "has_contradiction": False,
                "citations": citations
            })

        except Exception as e:
            print(f"[TOOL V2] generate_summary error: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return json.dumps({
                "answer": "Something went wrong while generating the summary.",
                "has_contradiction": False,
                "citations": []
            })

    return generate_section_summary_tool
