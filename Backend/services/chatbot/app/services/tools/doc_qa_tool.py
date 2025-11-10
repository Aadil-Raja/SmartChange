# app/services/tools/doc_qa_tool.py
from pydantic import BaseModel, Field
from langchain.tools import tool
import sys

class DocQAToolArgs(BaseModel):
    question: str = Field(description="The question to answer from the document")
    top_k: int = Field(default=5, description="Number of chunks to retrieve")

def make_doc_qa_tool(chunk_db, document_id: int):
    """
    Returns a LangChain tool that the agent can use.
    """
    from app.services.rag_service import doc_qa

    @tool(args_schema=DocQAToolArgs)
    def doc_qa_tool(question: str, top_k: int = 3) -> str:
        """Answer a question from the selected document using retrieved context and provide follow-up questions."""
        print(f"\n[TOOL CALLED] doc_qa_tool", file=sys.stderr)
        print(f"[TOOL] Question: {question}", file=sys.stderr)
        print(f"[TOOL] Top K: {top_k}", file=sys.stderr)
        print(f"[TOOL] Document ID (fixed): {document_id}", file=sys.stderr)
        
        try:
            result = doc_qa(chunk_db, document_id=document_id, question=question, top_k=top_k)
            answer = result.get("text", "No answer found.")
            sources = result.get("sources", [])
            follow_up_questions = result.get("follow_up_questions", [])
            
            print(f"[TOOL] ✓ Success - Answer length: {len(answer)} chars", file=sys.stderr)
            print(f"[TOOL] Sources: {sources}", file=sys.stderr)
            print(f"[TOOL] Follow-up questions: {follow_up_questions}", file=sys.stderr)
            
            # Format response with follow-up questions
            response = answer
            if follow_up_questions:
                response += "\n\n📌 You might also want to explore:\n"
                for i, q in enumerate(follow_up_questions, 1):
                    response += f"{i}. {q}\n"
            
            return response
            
        except Exception as e:
            print(f"[TOOL] ✗ Error: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            return f"Error retrieving answer: {str(e)}"
    
    return doc_qa_tool