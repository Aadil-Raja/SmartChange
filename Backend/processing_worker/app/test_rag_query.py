"""
RAG Query Testing - Test document retrieval and question answering
Usage: python test_rag_query.py
"""
import sys
import os
sys.path.insert(0, '.')

import google.generativeai as genai
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import List, Dict, Any

# Import models and repos
from shared.models.Document import DocumentChunk
from shared.models.Document import Document
from repos.chunks_repo import get_chunks_repo
from repos.documents_repo import DocumentsRepository
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())
# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

if not GOOGLE_API_KEY:
    print("ERROR: GOOGLE_API_KEY environment variable not set!")
    sys.exit(1)

# Initialize Gemini
genai.configure(api_key=GOOGLE_API_KEY)

# Database setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def get_document_info(db, document_id: int) -> Dict[str, Any]:
    """Get document metadata."""
    docs_repo = DocumentsRepository(db)
    doc = docs_repo.get_by_id(document_id)
    
    if not doc:
        return None
    
    return {
        "id": doc.id,
        "title": doc.title,
        "original_filename": doc.original_filename,
        "mime_type": doc.mime_type,
        "status": doc.status,
        "size_bytes": doc.size_bytes,
        "created_at": doc.created_at
    }


def get_all_chunks(db, document_id: int) -> List[DocumentChunk]:
    """Fetch all chunks for a document."""
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(DocumentChunk.chunk_index).all()
    
    return chunks


def generate_query_embedding(query: str) -> List[float]:
    """Generate embedding for user query."""
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=query,
            task_type="retrieval_query"
        )
        
        # Debug: print result structure
        print(f"  Debug - Result type: {type(result)}")
        print(f"  Debug - Has 'embedding': {hasattr(result, 'embedding')}")
        
        if hasattr(result, 'embedding'):
            emb = result.embedding
            print(f"  Debug - Embedding type: {type(emb)}")
            print(f"  Debug - Has 'values': {hasattr(emb, 'values')}")
            
            if hasattr(emb, 'values'):
                return emb.values
            elif isinstance(emb, list):
                return emb
            else:
                # Try to convert to list
                return list(emb)
        
        # If no embedding attribute, maybe it's a dict
        if isinstance(result, dict) and 'embedding' in result:
            return result['embedding']
        
        raise ValueError(f"Unexpected result structure: {type(result)}, attributes: {dir(result)}")
        
    except Exception as e:
        print(f"  Error details: {e}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Failed to generate query embedding: {e}")


def search_similar_chunks(db, document_id: int, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
    """Search for similar chunks using vector similarity."""
    # Note: This uses pgvector's cosine distance
    # You need to have pgvector extension installed in PostgreSQL
    
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).order_by(
        DocumentChunk.embedding.cosine_distance(query_embedding)
    ).limit(top_k).all()
    
    results = []
    for chunk in chunks:
        results.append({
            "chunk_id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "text": chunk.text,
            "section_title": chunk.section_title,
            "page_num": chunk.page_num,
            "char_start": chunk.char_start,
            "char_end": chunk.char_end,
            "token_count": chunk.token_count
        })
    
    return results


def answer_question(query: str, context_chunks: List[Dict[str, Any]], document_info: Dict[str, Any]) -> str:
    """Use Gemini to answer question based on retrieved chunks."""
    
    # Build context from chunks
    context_text = ""
    for i, chunk in enumerate(context_chunks, 1):
        section = chunk.get('section_title', 'Unknown Section')
        text = chunk['text']
        context_text += f"\n--- Chunk {i} (Section: {section}) ---\n{text}\n"
    
    # Create prompt
    prompt = f"""
You are a helpful AI assistant answering questions about a document.

**Document Information:**
- Title: {document_info['title']}
- Filename: {document_info['original_filename']}
- Type: {document_info['mime_type']}

**Retrieved Context:**
{context_text}

**User Question:**
{query}

**Instructions:**
1. Answer the question based ONLY on the provided context
2. If the context doesn't contain enough information, say "I don't have enough information in this document to answer that."
3. Be specific and cite which section the information comes from
4. Keep your answer concise and relevant

**Answer:**
"""
    
    # Generate response
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content(prompt)
    
    return response.text


def interactive_query(document_id: int):
    """Interactive query loop for a document."""
    db = SessionLocal()
    
    try:
        # Get document info
        print("=" * 80)
        print("LOADING DOCUMENT...")
        print("=" * 80)
        
        doc_info = get_document_info(db, document_id)
        if not doc_info:
            print(f"ERROR: Document {document_id} not found!")
            return
        
        print(f"Document ID: {doc_info['id']}")
        print(f"Title: {doc_info['title']}")
        print(f"Filename: {doc_info['original_filename']}")
        print(f"Type: {doc_info['mime_type']}")
        print(f"Status: {doc_info['status']}")
        print(f"Size: {doc_info['size_bytes']} bytes")
        print()
        
        # Get chunk count
        chunks = get_all_chunks(db, document_id)
        print(f"Total chunks available: {len(chunks)}")
        
        if len(chunks) == 0:
            print("ERROR: No chunks found for this document. Has it been processed?")
            return
        
        print()
        print("=" * 80)
        print("RAG QUERY SYSTEM - Ready!")
        print("=" * 80)
        print("Type your questions below. Type 'quit' or 'exit' to stop.")
        print("Type 'chunks' to see all chunk summaries.")
        print()
        
        while True:
            # Get user query
            query = input("\n🔍 Your question: ").strip()
            
            if not query:
                continue
            
            if query.lower() in ['quit', 'exit', 'q']:
                print("Goodbye!")
                break
            
            if query.lower() == 'chunks':
                print("\n📄 Available chunks:")
                for chunk in chunks:
                    section = chunk.section_title or "No section"
                    preview = chunk.text[:100] + "..." if len(chunk.text) > 100 else chunk.text
                    print(f"\n  Chunk {chunk.chunk_index} [{section}]:")
                    print(f"    {preview}")
                continue
            
            try:
                # Generate query embedding
                print("\n⏳ Searching relevant chunks...")
                query_embedding = generate_query_embedding(query)
                
                # Search similar chunks
                similar_chunks = search_similar_chunks(db, document_id, query_embedding, top_k=5)
                
                print(f"✓ Found {len(similar_chunks)} relevant chunks")
                
                # Show retrieved chunks
                print("\n📚 Retrieved context:")
                for i, chunk in enumerate(similar_chunks, 1):
                    section = chunk.get('section_title', 'Unknown')
                    preview = chunk['text'][:150] + "..." if len(chunk['text']) > 150 else chunk['text']
                    print(f"  {i}. [{section}] {preview}")
                
                # Generate answer
                print("\n🤖 Generating answer...")
                answer = answer_question(query, similar_chunks, doc_info)
                
                print("\n" + "=" * 80)
                print("ANSWER:")
                print("=" * 80)
                print(answer)
                print("=" * 80)
                
            except Exception as e:
                print(f"\n❌ Error: {e}")
                import traceback
                traceback.print_exc()
    
    finally:
        db.close()


def single_query(document_id: int, question: str):
    """Run a single query (non-interactive)."""
    db = SessionLocal()
    
    try:
        # Get document info
        doc_info = get_document_info(db, document_id)
        if not doc_info:
            print(f"ERROR: Document {document_id} not found!")
            return
        
        print(f"\n📄 Document: {doc_info['title']} ({doc_info['original_filename']})")
        print(f"❓ Question: {question}\n")
        
        # Generate query embedding
        query_embedding = generate_query_embedding(question)
        
        # Search similar chunks
        similar_chunks = search_similar_chunks(db, document_id, query_embedding, top_k=5)
        
        if not similar_chunks:
            print("No relevant chunks found!")
            return
        
        # Generate answer
        answer = answer_question(question, similar_chunks, doc_info)
        
        print("=" * 80)
        print("ANSWER:")
        print("=" * 80)
        print(answer)
        print("=" * 80)
        
    finally:
        db.close()


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║           RAG Query Testing System                           ║
║           Test document retrieval and Q&A                    ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    # Get document ID
    if len(sys.argv) > 1:
        try:
            doc_id = int(sys.argv[1])
        except ValueError:
            print("ERROR: Document ID must be a number")
            sys.exit(1)
    else:
        doc_id = input("Enter document ID to query: ").strip()
        try:
            doc_id = int(doc_id)
        except ValueError:
            print("ERROR: Document ID must be a number")
            sys.exit(1)
    
    # Check if there's a question in arguments
    if len(sys.argv) > 2:
        question = " ".join(sys.argv[2:])
        single_query(doc_id, question)
    else:
        interactive_query(doc_id)
