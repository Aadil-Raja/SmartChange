# # app/services/tools/doc_topics_tool.py

# from pydantic import BaseModel
# from langchain.tools import tool
# import sys
# import json

# class DocTopicsToolArgs(BaseModel):
#     """No arguments needed - uses the currently selected document"""
#     pass

# def make_doc_topics_tool(chunk_db, document_ids: list[int]):
#     """
#     Returns a LangChain tool that retrieves main topics from multiple documents.
#     chunk_db contains both documents and document_chunks tables.
#     """
#     from shared.models.Document import Document

#     @tool(args_schema=DocTopicsToolArgs)
#     def doc_topics_tool() -> str:
#         """Get the main topics/overview of the currently selected documents."""
#         print(f"\n[TOOL CALLED] doc_topics_tool", file=sys.stderr)
#         print(f"[TOOL] Document IDs: {document_ids}", file=sys.stderr)
        
#         try:
#             # Fetch documents from database
#             docs = chunk_db.query(Document).filter(Document.id.in_(document_ids)).all()
            
#             if not docs:
#                 print(f"[TOOL] ✗ No documents found", file=sys.stderr)
#                 return f"No documents found with IDs {document_ids}."
            
#             print(f"[TOOL] ✓ Found {len(docs)} documents", file=sys.stderr)
            
#             # Build response for multiple documents
#             response_parts = []
            
#             for doc in docs:
#                 print(f"[TOOL] Processing: {doc.title}", file=sys.stderr)
                
#                 main_topics = doc.main_topics
                
#                 if not main_topics or (isinstance(main_topics, dict) and not main_topics):
#                     response_parts.append(f"📄 **{doc.title}**\nNo main topics have been extracted yet.")
#                     continue
                
#                 # Format topics for readability
#                 if isinstance(main_topics, dict):
#                     topics_list = []
#                     for topic, desc in main_topics.items():
#                         topics_list.append(f"  • {topic}: {desc}")
#                     topics_str = "\n".join(topics_list)
#                 elif isinstance(main_topics, list):
#                     topics_str = "\n".join([f"  • {topic}" for topic in main_topics])
#                 else:
#                     topics_str = f"  {str(main_topics)}"
                
#                 response_parts.append(f"📄 **{doc.title}**\n{topics_str}")
            
#             response = "\n\n".join(response_parts)
            
#             print(f"[TOOL] ✓ Success - Response length: {len(response)} chars", file=sys.stderr)
            
#             return response
            
#         except Exception as e:
#             print(f"[TOOL] ✗ Error: {e}", file=sys.stderr)
#             import traceback
#             traceback.print_exc(file=sys.stderr)
#             return f"Error retrieving document topics: {str(e)}"
    
#     return doc_topics_tool