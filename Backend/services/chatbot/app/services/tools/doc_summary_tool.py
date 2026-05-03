# # app/services/tools/doc_summary_tool.py

# from pydantic import BaseModel, Field
# from langchain.tools import tool
# import sys

# from shared.llm import embed_single, create_llm_provider
# from app.core.config import get_settings

# settings = get_settings()

# class DocSummaryToolArgs(BaseModel):
#     """Arguments for document summary generation"""
#     chunks_per_topic: int = Field(
#         default=2, 
#         description="Number of chunks to retrieve per topic for summary generation (1-3 recommended)"
#     )

# def make_doc_summary_tool(chunk_db, document_id: int):
#     """
#     Returns a LangChain tool that generates a summary based on document topics.
#     Retrieves relevant chunks for each topic and creates a concise summary.
#     chunk_db contains both documents and document_chunks tables.
#     """
#     from shared.models.Document import Document, DocumentChunk
#     import numpy as np

#     @tool(args_schema=DocSummaryToolArgs)
#     def doc_summary_tool(chunks_per_topic: int = 2) -> str:
#         """Generate a topic-based summary of the document using retrieved content."""
#         debug_log(f"\n[TOOL CALLED] doc_summary_tool", "TOOL")
#         debug_log(f"Document ID (fixed): {document_id}", "TOOL")
#         debug_log(f"Chunks per topic: {chunks_per_topic}", "TOOL")
        
#         # Limit chunks_per_topic to reasonable range
#         chunks_per_topic = max(1, min(chunks_per_topic, 3))
#         debug_log(f"Adjusted chunks_per_topic: {chunks_per_topic}", "TOOL")
        
#         try:
#             # Fetch document
#             doc = chunk_db.query(Document).filter(Document.id == document_id).first()
            
#             if not doc:
#                 debug_log(f"✗ Document not found: {document_id}", "TOOL")
#                 return f"Document with ID {document_id} not found."
            
#             debug_log(f"✓ Found document: {doc.title}", "TOOL")
            
#             # Get main topics
#             main_topics = doc.main_topics
            
#             if not main_topics or (isinstance(main_topics, dict) and not main_topics):
#                 debug_log(f"⚠ No topics found, falling back to general summary", "TOOL")
#                 return _generate_general_summary(chunk_db, document_id, doc.title)
            
#             debug_log(f"✓ Found {len(main_topics)} topics", "TOOL")
            
#             # Collect chunks for each topic
#             topic_contexts = {}
#             total_chunks_retrieved = 0
            
#             for topic_name, topic_desc in main_topics.items():
#                 debug_log(f"\n[TOOL] Processing topic: {topic_name}", "TOOL")
                
#                 # Create search query from topic name and description
#                 search_query = f"{topic_name} {topic_desc}"
#                 debug_log(f"  Search query: {search_query[:100]}...", "TOOL")
                
#                 # Get embedding for this topic
#                 topic_embedding = generate_query_embedding(
#                     query=search_query,
#                     api_key=settings.google_api_key
#                 )
                
#                 # Retrieve most relevant chunks for this topic
#                 chunks = (
#                     chunk_db.query(DocumentChunk)
#                     .filter(DocumentChunk.document_id == document_id)
#                     .order_by(DocumentChunk.embedding.cosine_distance(topic_embedding))
#                     .limit(chunks_per_topic)
#                     .all()
#                 )
                
#                 debug_log(f"  Retrieved {len(chunks)} chunks", "TOOL")
#                 total_chunks_retrieved += len(chunks)
                
#                 # Store chunks for this topic
#                 topic_contexts[topic_name] = {
#                     "description": topic_desc,
#                     "chunks": [c.text for c in chunks]
#                 }
            
#             debug_log(f"\n[TOOL] Total chunks retrieved: {total_chunks_retrieved}", "TOOL")
            
#             # Generate summary using LLM
#             summary = _generate_topic_summary(doc.title, topic_contexts)
            
#             debug_log(f"✓ Success - Summary length: {len(summary)} chars", "TOOL")
            
#             return summary
            
#         except Exception as e:
#             debug_log(f"✗ Error: {e}", "TOOL")
#             import traceback
#             traceback.print_exc(file=sys.stderr)
#             return f"Error generating document summary: {str(e)}"
    
#     return doc_summary_tool


# def _generate_topic_summary(doc_title: str, topic_contexts: dict) -> str:
#     """Generate a concise summary using LLM based on topic contexts."""
    
#     # Build context string efficiently
#     context_parts = []
#     total_context_length = 0
    
#     for topic_name, data in topic_contexts.items():
#         context_parts.append(f"\n### {topic_name}")
#         context_parts.append(f"Focus: {data['description']}")
        
#         for i, chunk_text in enumerate(data['chunks'], 1):
#             # Limit each chunk to 300 chars to control token usage
#             truncated_chunk = chunk_text[:300] + ("..." if len(chunk_text) > 300 else "")
#             context_parts.append(f"\nExcerpt {i}: {truncated_chunk}")
#             total_context_length += len(truncated_chunk)
    
#     context_text = "\n".join(context_parts)
    
#     debug_log(f"  → Total context length: {total_context_length} chars", "TOOL")
    
#     # Efficient prompt for summary generation
#     prompt = f"""Summarize this document based on its main topics and excerpts.

# Document: {doc_title}

# Content by Topic:
# {context_text}

# Provide a concise summary (3-5 sentences per topic) covering:
# 1. What each topic includes
# 2. Key points from the excerpts

# Keep the summary clear and under 500 words total."""
    
#     debug_log(f"  → Prompt length: {len(prompt)} chars", "TOOL")
#     debug_log(f"  → Calling LLM ({settings.llm_model})...", "TOOL")
    
#     try:
#         # Create LLM provider using shared utility
#         llm = create_llm_provider(
#             llm_provider=settings.llm_provider,
#             llm_model=settings.llm_model,
#             google_api_key=settings.google_api_key,
#             openai_api_key=settings.openai_api_key
#         )
        
#         summary = llm.generate(prompt)
#         debug_log(f"  → Summary length: {len(summary)} chars", "TOOL")
        
#         return summary
        
#     except Exception as e:
#         debug_log(f"  ✗ LLM ERROR: {e}", "TOOL")
#         return f"Error generating summary: {str(e)}"


# def _generate_general_summary(chunk_db, document_id: int, doc_title: str) -> str:
#     """Fallback: Generate summary from first few chunks if no topics available."""
#     from shared.models.Document import DocumentChunk

# Import debug logger
from app.utils.debug_logger import debug_log
    
#     debug_log(f"  → Generating general summary (no topics available)", "TOOL")
    
#     try:
#         # Get first 5 chunks
#         chunks = (
#             chunk_db.query(DocumentChunk)
#             .filter(DocumentChunk.document_id == document_id)
#             .order_by(DocumentChunk.chunk_index)
#             .limit(5)
#             .all()
#         )
        
#         if not chunks:
#             return f"No content available to summarize for '{doc_title}'."
        
#         # Combine chunks (with length limit)
#         combined_text = " ".join([c.text[:200] for c in chunks])[:1000]
        
#         prompt = f"""Provide a brief summary (3-4 sentences) of this document excerpt.

# Document: {doc_title}

# Excerpt:
# {combined_text}

# Summary:"""
        
#         # Create LLM provider using shared utility
#         llm = create_llm_provider(
#             llm_provider=settings.llm_provider,
#             llm_model=settings.llm_model,
#             google_api_key=settings.google_api_key,
#             openai_api_key=settings.openai_api_key
#         )
        
#         return llm.generate(prompt)
        
#     except Exception as e:
#         debug_log(f"  ✗ Error in general summary: {e}", "TOOL")
#         return f"Unable to generate summary for '{doc_title}'."