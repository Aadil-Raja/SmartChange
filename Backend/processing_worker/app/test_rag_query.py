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
from repos import chunks_repo
from shared.repos import documents_repo as docs_repo
from core.config import get_settings
from pipeline.embeddings import create_embedding_service, EmbeddingConfig

# Configuration
settings = get_settings()

# Initialize embedding service using factory function
embedding_config = EmbeddingConfig(
    model_name=settings.embedding_model,
    batch_size=settings.embedding_batch_size,
    max_retries=settings.embedding_max_retries,
    dimension=settings.embedding_dimension,
)
embedding_service = create_embedding_service(settings.google_api_key, embedding_config)

# Database setup
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine)


def generate_query_embedding(query: str) -> List[float]:
    """Generate embedding for user query using the EmbeddingService."""
    embeddings = embedding_service.embed_texts([query])
    return embeddings[0]


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
    
    # Generate response using genai (already configured in embedding_service)
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
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
        
        doc_info = docs_repo.get_document_info(db, document_id)
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
        chunks = chunks_repo.get_by_document(db, document_id, include_embeddings=False)
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
                
                # Search similar chunks using repository
                similar_chunks = chunks_repo.search_similar(
                    db,
                    query_embedding=query_embedding,
                    limit=5,
                    document_id=document_id
                )
                
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
        doc_info = docs_repo.get_document_info(document_id)
        if not doc_info:
            print(f"ERROR: Document {document_id} not found!")
            return
        
        print(f"\n📄 Document: {doc_info['title']} ({doc_info['original_filename']})")
        print(f"❓ Question: {question}\n")
        
        # Generate query embedding
        query_embedding = generate_query_embedding(question)
        
        # Search similar chunks using repository
        similar_chunks = chunks_repo.search_similar(
            db,
            query_embedding=query_embedding,
            limit=5,
            document_id=document_id
        )
        
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
