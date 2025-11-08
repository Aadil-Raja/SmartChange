# app/services/tools/doc_topics_tool.py

from pydantic import BaseModel
from langchain.tools import tool
import sys
import json

class DocTopicsToolArgs(BaseModel):
    """No arguments needed - uses the currently selected document"""
    pass

def make_doc_topics_tool(chunk_db, document_id: int):
    """
    Returns a LangChain tool that retrieves main topics from the document metadata.
    chunk_db contains both documents and document_chunks tables.
    """
    from shared.models.Document import Document

    @tool(args_schema=DocTopicsToolArgs)
    def doc_topics_tool() -> str:
        """Get the main topics/overview of the currently selected document."""
        print(f"\n[TOOL CALLED] doc_topics_tool", file=sys.stderr)
        print(f"[TOOL] Document ID (fixed): {document_id}", file=sys.stderr)
        
        try:
            # Fetch document from database
            doc = chunk_db.query(Document).filter(Document.id == document_id).first()
            
            if not doc:
                print(f"[TOOL] ✗ Document not found: {document_id}", file=sys.stderr)
                return f"Document with ID {document_id} not found."
            
            print(f"[TOOL] ✓ Found document: {doc.title}", file=sys.stderr)
            
            # Get main topics from JSON field
            print(doc)
            main_topics = doc.main_topics
            
            if not main_topics or (isinstance(main_topics, dict) and not main_topics):
                print(f"[TOOL] ⚠ No topics found for document", file=sys.stderr)
                return f"No main topics have been extracted for '{doc.title}' yet."
            
            print(f"[TOOL] ✓ Retrieved topics: {main_topics}", file=sys.stderr)
            
            # Format topics for readability
            if isinstance(main_topics, dict):
                # Format as topic: description pairs
                topics_list = []
                for topic, desc in main_topics.items():
                    topics_list.append(f"• {topic}: {desc}")
                topics_str = "\n".join(topics_list)
            elif isinstance(main_topics, list):
                topics_str = "\n".join([f"• {topic}" for topic in main_topics])
            else:
                topics_str = str(main_topics)
            
            response = f"Main topics covered in '{doc.title}':\n\n{topics_str}"
            
            print(f"[TOOL] ✓ Success - Response length: {len(response)} chars", file=sys.stderr)
            
            return response
            
        except Exception as e:
            print(f"[TOOL] ✗ Error: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return f"Error retrieving document topics: {str(e)}"
    
    return doc_topics_tool