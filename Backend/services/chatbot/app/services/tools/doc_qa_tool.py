# app/services/tools/doc_qa_tool.py
from pydantic import BaseModel, Field
from langchain.tools import tool
import sys
from typing import List

# Import debug logger
from app.utils.debug_logger import debug_log

# Tune these constants to control relevance filtering
ABSOLUTE_MIN_SCORE = 0.45   # A chunk must clear this regardless of other docs
RELATIVE_RATIO = 0.75       # A chunk must be within 75% of the best score across all docs
TOP_K_PER_DOC = 3           # Max chunks to retrieve per document


class DocQAToolArgs(BaseModel):
    question: str = Field(description="The question to answer from the selected documents")


def make_doc_qa_tool(chunk_db, document_ids: List[int]):
    """
    Returns a LangChain tool that searches across multiple documents,
    filters chunks by relevance using absolute + relative cosine score thresholds,
    synthesizes a single unified answer, and provides citations.
    """
    from app.services.rag_service import retrieve_chunks_with_scores
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../../..'))
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
        """
        debug_log(f"\n[TOOL CALLED] doc_qa_tool", "TOOL")
        debug_log(f"Question: {question}", "TOOL")
        debug_log(f"Document IDs: {document_ids}", "TOOL")

        try:
            if not document_ids:
                return "No documents selected. Please select at least one document to search."

            # Step 1: Retrieve top_k chunks with scores from each document
            # NOTE: retrieve_chunks_with_scores must return a list of dicts:
            # [{"text": str, "score": float, "chunk_index": int}, ...]
            # If your rag_service uses a different return format, adapt here.
            raw_results = {}  # doc_id -> {"doc_name": str, "chunks": [...]}

            for doc_id in document_ids:
                try:
                    doc = documents_repo.get_by_id(chunk_db, doc_id)
                    doc_name = doc.title if doc else f"Document {doc_id}"

                    chunks = retrieve_chunks_with_scores(
                        chunk_db,
                        document_id=doc_id,
                        question=question,
                        top_k=TOP_K_PER_DOC
                    )

                    if chunks:
                        raw_results[doc_id] = {
                            "doc_name": doc_name,
                            "chunks": chunks  # each chunk: {"text": ..., "score": ...}
                        }
                        print(f"[TOOL] Doc {doc_id} ('{doc_name}'): {len(chunks)} chunks, "
                              f"top score={chunks[0]['score']:.3f}", file=sys.stderr)
                    else:
                        debug_log(f"Doc {doc_id}: no chunks returned", "TOOL")

                except Exception as e:
                    debug_log(f"Error retrieving chunks for doc {doc_id}: {e}", "TOOL")
                    continue

            if not raw_results:
                return "No relevant information could be retrieved from the selected documents."

            # Step 2: Find the best score across all docs and compute threshold
            best_score = max(
                chunks["chunks"][0]["score"]
                for chunks in raw_results.values()
                if chunks["chunks"]
            )
            threshold = max(ABSOLUTE_MIN_SCORE, best_score * RELATIVE_RATIO)

            debug_log(f"Best score across all docs: {best_score:.3f}", "TOOL")
            print(f"[TOOL] Relevance threshold: {threshold:.3f} "
                  f"(max({ABSOLUTE_MIN_SCORE}, {best_score:.3f} * {RELATIVE_RATIO}))", file=sys.stderr)

            # Step 3: Filter chunks by threshold, build labeled context
            relevant_sources = []   # tracks which docs contributed
            context_blocks = []     # labeled text blocks for LLM

            for doc_id, data in raw_results.items():
                doc_name = data["doc_name"]
                passing_chunks = [
                    c for c in data["chunks"]
                    if c["score"] >= threshold
                ]

                if not passing_chunks:
                    print(f"[TOOL] Doc '{doc_name}' dropped — all chunks below threshold "
                          f"(top score={data['chunks'][0]['score']:.3f})", file=sys.stderr)
                    continue

                debug_log(f"Doc '{doc_name}': {len(passing_chunks)} chunks passed threshold", "TOOL")
                relevant_sources.append(doc_name)

                chunk_texts = "\n\n".join([c["text"] for c in passing_chunks])
                context_blocks.append(
                    f"[Source: {doc_name}]\n{chunk_texts}"
                )

            # Step 4: No relevant chunks found anywhere
            if not context_blocks:
                return (
                    "The selected documents do not appear to contain relevant information "
                    "to answer this question. Please try rephrasing or selecting different documents."
                )

            # Step 5: Build prompt and call LLM for unified answer
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
            source_list = ", ".join(relevant_sources)

            prompt = f"""You are answering a question using content retrieved from one or more documents.
Each source block is labeled with its document name in brackets.

Question: {question}

Retrieved Content:
{full_context}

Instructions:
- Answer the question directly and concisely using only the content provided above.
- If different sources contribute different points, integrate them into a unified answer.
- Where a specific fact comes from a specific document, note it inline using the format: (Source: Document Name)
- If the content does not contain enough information to answer the question, say so clearly.
- Do not make up information not present in the retrieved content.

Answer:"""

            answer = llm.generate(prompt)
            debug_log(f"Answer generated ({len(answer.split())} words)", "TOOL")

            # Step 6: Append citation list at the bottom
            response = answer.strip()
            response += "\n\n---\n**Sources consulted:**\n"
            for i, name in enumerate(relevant_sources, 1):
                response += f"{i}. {name}\n"

            return response

        except Exception as e:
            debug_log(f"Error: {e}", "TOOL")
            import traceback
            traceback.print_exc(file=sys.stderr)
            return "Something went wrong while searching the documents. Please try again or contact support if the issue persists."

    return doc_qa_tool