# app/services/tools/doc_qa_tool_v2.py
"""
V2 doc QA tool - returns structured dict with answer, citations, has_contradiction.
Used by agent_service_v2 for the /respond-v2 endpoint.
"""
from pydantic import BaseModel, Field
from langchain.tools import tool
from typing import List
import sys
import json

ABSOLUTE_MIN_SCORE = 0.45
RELATIVE_RATIO = 0.75
TOP_K_PER_DOC = 3


class DocQAToolArgs(BaseModel):
    question: str = Field(description="The question to answer from the selected documents")


def make_doc_qa_tool_v2(chunk_db, document_ids: List[int]):
    """
    V2 tool: returns a JSON string with {answer, has_contradiction, citations}.
    Each citation has doc_id, doc_title, page, section, snippet.
    """
    from app.services.rag_service import retrieve_chunks_with_scores
    from shared.repos import documents_repo

    @tool(args_schema=DocQAToolArgs)
    def doc_qa_tool(question: str) -> str:
        """Answer questions by searching across all selected documents.

        Use this tool for any specific question about document content such as:
        - "What is X?", "How does Y work?", "Explain Z"
        - "What are the requirements for...?", "Who is responsible for...?"
        - "What does the document say about...?"
        - Factual lookups, definitions, procedures, rules, or any content question

        Do NOT use this tool when the user wants a summary, overview, table of
        contents, or section list — use list_document_sections_tool for those.

        Returns a JSON string with keys: answer, has_contradiction, citations.
        IMPORTANT: Return the tool output EXACTLY as-is. Do not reformat or summarize it.
        """
        print(f"\n[TOOL V2] doc_qa_tool called", file=sys.stderr)
        print(f"[TOOL V2] Question: {question}", file=sys.stderr)
        print(f"[TOOL V2] Document IDs: {document_ids}", file=sys.stderr)

        try:
            if not document_ids:
                return json.dumps({
                    "answer": "No documents selected. Please select at least one document.",
                    "has_contradiction": False,
                    "citations": []
                })

            # Step 1: Retrieve chunks with scores from each document
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
                        raw_results[doc_id] = {"doc_title": doc_title, "chunks": chunks}
                        print(f"[TOOL V2] Doc {doc_id} ('{doc_title}'): {len(chunks)} chunks, "
                              f"top score={chunks[0]['score']:.3f}", file=sys.stderr)
                        print(f"[TOOL V2] All chunks for doc {doc_id}:", file=sys.stderr)
                        for i, c in enumerate(chunks, 1):
                            print(f"  Chunk {i}: score={c['score']:.4f} | page={c.get('start_page_num')} | "
                                  f"section={c.get('section_title')} | preview={c['text'][:80].replace(chr(10), ' ')}...",
                                  file=sys.stderr)
                except Exception as e:
                    print(f"[TOOL V2] Error for doc {doc_id}: {e}", file=sys.stderr)
                    continue

            if not raw_results:
                return json.dumps({
                    "answer": "No relevant information could be retrieved from the selected documents.",
                    "has_contradiction": False,
                    "citations": []
                })

            # Step 2: Compute relevance threshold
            best_score = max(
                data["chunks"][0]["score"]
                for data in raw_results.values()
                if data["chunks"]
            )
            threshold = max(ABSOLUTE_MIN_SCORE, best_score * RELATIVE_RATIO)
            print(f"[TOOL V2] Best score: {best_score:.3f}, threshold: {threshold:.3f}", file=sys.stderr)

            # Step 3: Filter chunks and build context + citations
            context_blocks = []
            citations = []

            for doc_id, data in raw_results.items():
                doc_title = data["doc_title"]
                passing_chunks = [c for c in data["chunks"] if c["score"] >= threshold]

                if not passing_chunks:
                    print(f"[TOOL V2] Doc '{doc_title}' dropped - below threshold", file=sys.stderr)
                    continue

                chunk_texts = "\n\n".join([c["text"] for c in passing_chunks])
                context_blocks.append(f"[Source: {doc_title}]\n{chunk_texts}")

                for c in passing_chunks:
                    page = c.get("start_page_num")
                    citations.append({
                        "doc_id": doc_id,
                        "doc_title": doc_title,
                        "page": page,
                        "section": c.get("section_title"),
                        "snippet": c["text"][:150].strip()
                    })

            if not context_blocks:
                return json.dumps({
                    "answer": "The selected documents do not contain relevant information for this question.",
                    "has_contradiction": False,
                    "citations": []
                })

            # Step 4: Call LLM for unified answer with contradiction detection
            from shared.llm import create_llm_provider
            from app.core.config import get_settings
            settings = get_settings()

            llm = create_llm_provider(
                llm_provider=settings.llm_provider,
                llm_model=settings.llm_model,
                google_api_key=settings.google_api_key,
                openai_api_key=settings.openai_api_key
            )

            full_context = "\n\n---\n\n".join(context_blocks)
            num_docs = len(context_blocks)

            prompt = f"""You are answering a question using content retrieved from {num_docs} document(s).
Each source block is labeled with its document name in brackets.

Question: {question}

Retrieved Content:
{full_context}

Instructions:
1. Provide ONE unified answer combining all relevant information.
2. If different sources contribute different points, integrate them naturally.
3. CONTRADICTION DETECTION: If two or more documents provide conflicting information
   on the same specific point (e.g. different numbers, opposite statements, contradictory rules),
   you MUST explicitly note it like:
   "Note: The documents contradict each other on this point —
    [Doc A] states X while [Doc B] states Y."
   Then recommend the safer or more authoritative option if possible.
4. If no contradiction exists, answer normally without mentioning contradictions.
5. Do not make up information not present in the retrieved content.

You MUST respond with ONLY valid JSON in this exact format:
{{
  "answer": "your full answer here",
  "has_contradiction": true or false
}}"""

            result = llm.generate_json(prompt)
            answer = result.get("answer", "Could not generate an answer.")
            has_contradiction = result.get("has_contradiction", False)

            print(f"[TOOL V2] Answer generated, has_contradiction={has_contradiction}", file=sys.stderr)

            return json.dumps({
                "answer": answer,
                "has_contradiction": has_contradiction,
                "citations": citations
            })

        except Exception as e:
            print(f"[TOOL V2] Error: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return json.dumps({
                "answer": "Something went wrong while searching the documents. Please try again.",
                "has_contradiction": False,
                "citations": []
            })

    return doc_qa_tool
