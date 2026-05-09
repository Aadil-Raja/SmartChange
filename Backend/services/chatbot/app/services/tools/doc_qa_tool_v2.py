# app/services/tools/doc_qa_tool_v2.py
"""
V2 doc QA tool - returns structured dict with answer, citations, has_contradiction.
Used by agent_service_v2 for the /respond-v2 endpoint.

Filtering strategy:
- Best doc threshold:  max(0.65, best_score * 0.75)
- Other docs threshold: max(0.65, best_score * 0.85)
- LLM verifies which chunk IDs it actually used → secondary citation filter
"""

# Import debug logger
from app.utils.debug_logger import debug_log
from pydantic import BaseModel, Field
from langchain.tools import tool
from typing import List
import sys
import json

ABSOLUTE_FLOOR   = 0.60   # Hard minimum cosine similarity for any chunk
SAME_DOC_RATIO   = 0.75   # Threshold ratio for the best-scoring document
OTHER_DOC_RATIO  = 0.85   # Stricter threshold ratio for all other documents
TOP_K_PER_DOC    = 5      # Retrieve more candidates per doc


class DocQAToolArgs(BaseModel):
    question: str = Field(description="The question to answer from the selected documents")


def make_doc_qa_tool_v2(chunk_db, document_ids: List[int]):
    from app.services.rag_service import retrieve_chunks_with_scores
    from shared.repos import documents_repo

    @tool(args_schema=DocQAToolArgs, return_direct=True)
    def doc_qa_tool(question: str) -> str:
        """Answer questions by searching across all selected documents.

        Use this tool for any specific question about document content such as:
        - "What is X?", "How does Y work?", "Explain Z"
        - "What are the requirements for...?", "Who is responsible for...?"
        - "What does the document say about...?"
        - Factual lookups, definitions, procedures, rules, or any content question
        - Multiple questions in one message — combine them into a single question string

        Do NOT use this tool when the user wants a summary, overview, table of
        contents, or section list — use list_document_sections_tool for those.

        IMPORTANT: Call this tool ONLY ONCE per turn, even if the user asks multiple questions.
        Combine all questions into one question string.

        IMPORTANT: Do NOT call this tool immediately after list_document_sections_tool
        or generate_section_summary_tool. Those tools are self-contained and their
        output should be returned directly to the user without chaining to this tool.

        Returns a JSON string with keys: answer, has_contradiction, citations.
        IMPORTANT: Return the tool output EXACTLY as-is. Do not reformat or summarize it.
        """
        debug_log(f"\n[TOOL V2] doc_qa_tool called", "TOOL")
        debug_log(f"[TOOL V2] Question: {question}", "TOOL")
        debug_log(f"[TOOL V2] Document IDs: {document_ids}", "TOOL")

        try:
            if not document_ids:
                return json.dumps({
                    "answer": "No documents selected. Please select at least one document.",
                    "has_contradiction": False,
                    "citations": []
                })

            # ── Step 1: Retrieve top-k chunks per document ──────────────────
            raw_results = {}
            for doc_id in document_ids:
                try:
                    doc = documents_repo.get_by_id(chunk_db, doc_id)
                    doc_title = doc.title if doc else f"Document {doc_id}"

                    chunks = retrieve_chunks_with_scores(
                        chunk_db,
                        document_id=doc_id,
                        question=question,
                        top_k=TOP_K_PER_DOC
                    )

                    if chunks:
                        raw_results[doc_id] = {
                            "doc_title": doc_title,
                            "cloudinary_url": doc.cloudinary_url if doc else None,
                            "chunks": chunks
                        }
                        print(f"[TOOL V2] Doc {doc_id} ('{doc_title}'): {len(chunks)} chunks, "
                              f"top score={chunks[0]['score']:.3f}", file=sys.stderr)
                        for i, c in enumerate(chunks, 1):
                            print(f"  Chunk {i}: score={c['score']:.4f} | page={c.get('start_page_num')} | "
                                  f"chunk_index={c.get('chunk_index')} | "
                                  f"preview={c['text'][:80].replace(chr(10), ' ')}...",
                                  file=sys.stderr)
                except RuntimeError as e:
                    if "EMBEDDING_RATE_LIMIT" in str(e):
                        return json.dumps({
                            "answer": "The chatbot is temporarily unavailable due to high demand. Please try again in a moment.",
                            "has_contradiction": False,
                            "citations": []
                        })
                    debug_log(f"[TOOL V2] Error for doc {doc_id}: {e}", "TOOL")
                    continue
                except Exception as e:
                    debug_log(f"[TOOL V2] Error for doc {doc_id}: {e}", "TOOL")
                    continue

            if not raw_results:
                return json.dumps({
                    "answer": "No relevant information could be retrieved from the selected documents.",
                    "has_contradiction": False,
                    "citations": []
                })

            # ── Step 2: Tiered threshold filtering ──────────────────────────
            # Find overall best score and which doc it belongs to
            best_score = 0.0
            best_doc_id = None
            for doc_id, data in raw_results.items():
                if data["chunks"] and data["chunks"][0]["score"] > best_score:
                    best_score = data["chunks"][0]["score"]
                    best_doc_id = doc_id

            same_doc_threshold  = max(ABSOLUTE_FLOOR, best_score * SAME_DOC_RATIO)
            other_doc_threshold = max(ABSOLUTE_FLOOR, best_score * OTHER_DOC_RATIO)

            debug_log(f"[TOOL V2] Best score: {best_score:.3f} (doc {best_doc_id})", "TOOL")
            print(f"[TOOL V2] Same-doc threshold:  {same_doc_threshold:.3f} "
                  f"(max({ABSOLUTE_FLOOR}, {best_score:.3f} * {SAME_DOC_RATIO}))", file=sys.stderr)
            print(f"[TOOL V2] Other-doc threshold: {other_doc_threshold:.3f} "
                  f"(max({ABSOLUTE_FLOOR}, {best_score:.3f} * {OTHER_DOC_RATIO}))", file=sys.stderr)

            # Build labeled context with CHUNK_ID tags for LLM verification
            # chunk_map: chunk_id_str -> citation metadata
            context_blocks = []
            chunk_map = {}   # "DOC{doc_id}_CHUNK{chunk_index}" -> citation dict

            for doc_id, data in raw_results.items():
                doc_title = data["doc_title"]
                threshold = same_doc_threshold if doc_id == best_doc_id else other_doc_threshold
                passing_chunks = [c for c in data["chunks"] if c["score"] >= threshold]

                if not passing_chunks:
                    debug_log(f"[TOOL V2] Doc '{doc_title}' dropped - all chunks below threshold", "TOOL")
                    continue

                debug_log(f"[TOOL V2] Doc '{doc_title}': {len(passing_chunks)} chunks passed", "TOOL")

                block_lines = [f"[Source: {doc_title}]"]
                for c in passing_chunks:
                    cid = f"DOC{doc_id}_CHUNK{c['chunk_index']}"
                    block_lines.append(f"[CHUNK_ID: {cid}]\n{c['text']}")
                    # Store full metadata in chunk_map (never sent to LLM)
                    # cloudinary_url is attached here, not in the prompt
                    chunk_map[cid] = {
                        "doc_id": doc_id,
                        "doc_title": doc_title,
                        "cloudinary_url": data.get("cloudinary_url"),  # attached post-LLM
                        "page": c.get("start_page_num"),
                        "section": c.get("section_title"),
                        "snippet": c["text"][:150].strip()
                    }

                context_blocks.append("\n\n".join(block_lines))

            if not context_blocks:
                return json.dumps({
                    "answer": "The selected documents do not contain relevant information for this question.",
                    "has_contradiction": False,
                    "citations": []
                })

            # ── Step 3: LLM generates answer + reports used chunk IDs ───────
            from shared.llm import create_llm_provider
            from app.core.config import get_settings
            settings = get_settings()

            llm = create_llm_provider(
                llm_provider=settings.llm_provider,
                llm_model=settings.llm_model,
                google_api_key=settings.google_api_key,
                openai_api_key=settings.openai_api_key,
                max_output_tokens=settings.max_output_tokens
            )

            full_context = "\n\n---\n\n".join(context_blocks)
            available_chunk_ids = list(chunk_map.keys())

            prompt = f"""You are answering a question using content retrieved from documents.
Each chunk is labeled with [CHUNK_ID: ...] and its source document.

Question: {question}

Retrieved Content:
{full_context}

Instructions:
1. Provide ONE unified answer using only the content above.
2. If sources contribute different points, integrate them naturally.
3. CONTRADICTION DETECTION: If documents conflict on the same point, explicitly note:
   "Note: Documents contradict each other — [Doc A] states X while [Doc B] states Y."
   Then recommend the safer option if possible.
4. If no contradiction, answer normally.
5. Do not make up information not in the content.
6. In "used_chunk_ids", list ONLY the CHUNK_IDs that directly contain the specific facts answering the question.
   Do NOT include chunks used only for background context or general topic framing.
   Example: if asked "Who is Babar Azam?" and one chunk says "PSL is a cricket league" and another says "Babar Azam is a top batsman", only include the second chunk.
   Available chunk IDs: {available_chunk_ids}

EXAMPLE of correct output format:
Suppose the question is "What is the refund policy?" and you used DOC5_CHUNK2 and DOC5_CHUNK4:
{{
  "answer": "The refund policy allows returns within 30 days with a receipt.",
  "has_contradiction": false,
  "used_chunk_ids": ["DOC5_CHUNK2", "DOC5_CHUNK4"]
}}

If two docs contradict:
{{
  "answer": "Note: Documents contradict each other — Resume.pdf states 3.99 GPA while Transcript.pdf states 3.85 GPA.",
  "has_contradiction": true,
  "used_chunk_ids": ["DOC5_CHUNK2", "DOC7_CHUNK1"]
}}

Respond with ONLY valid JSON:
{{
  "answer": "your full answer here",
  "has_contradiction": true or false,
  "used_chunk_ids": ["list only chunk IDs you actually used"]
}}"""

            result = llm.generate_json(prompt)
            answer = result.get("answer", "Could not generate an answer.")
            has_contradiction = result.get("has_contradiction", False)
            used_chunk_ids = result.get("used_chunk_ids", [])

            debug_log(f"[TOOL V2] Answer generated, has_contradiction={has_contradiction}", "TOOL")
            debug_log(f"[TOOL V2] LLM used chunk IDs: {used_chunk_ids}", "TOOL")

            # ── Step 4: Build final citations using LLM-reported chunk IDs ──
            # Trust the LLM completely - if it used no chunks, citations = []
            final_citations = []
            for cid in used_chunk_ids:
                if cid in chunk_map:
                    final_citations.append(chunk_map[cid])
                else:
                    debug_log(f"[TOOL V2] Warning: LLM reported unknown chunk ID '{cid}'", "TOOL")

            debug_log(f"[TOOL V2] Final citations: {len(final_citations)}", "TOOL")

            return json.dumps({
                "answer": answer,
                "has_contradiction": has_contradiction,
                "citations": final_citations
            })

        except Exception as e:
            debug_log(f"[TOOL V2] Error: {e}", "TOOL")
            import traceback
            traceback.print_exc(file=sys.stderr)
            return json.dumps({
                "answer": "Something went wrong while searching the documents. Please try again.",
                "has_contradiction": False,
                "citations": []
            })

    return doc_qa_tool
