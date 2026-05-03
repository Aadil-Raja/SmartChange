"""
Test script for hybrid retrieval (Dense + Sparse + Reranking)

Usage:
    cd Backend/services/chatbot
    python app/testing/test_hybrid_retrieval.py
"""
import sys
from pathlib import Path

# Add chatbot directory to path
chatbot_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(chatbot_dir))

from dotenv import load_dotenv
env_file = chatbot_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)
    print(f"✓ Loaded environment from: {env_file}")

from app.deps.db import get_management_db
from app.services.tools.hybrid_retrieval import hybrid_retrieve_chunks


def test_hybrid_retrieval():
    """Test hybrid retrieval with a sample question."""
    
    print("\n" + "="*80)
    print("TESTING HYBRID RETRIEVAL")
    print("="*80)
    
    # Get database session
    db = next(get_management_db())
    
    try:
        # Test documents
        document_ids = [39, 41, 45]  # Switchgear, PSL, Aadil's resume
        
        # Test questions
        test_questions = [
            "What is the insulation resistance on page 191?",
            "What is Aadil's CGPA?",
            "What are the PSL team names?",
            "What is step 2 of the maintenance procedure?",
        ]
        
        for i, question in enumerate(test_questions, 1):
            print(f"\n{'─'*80}")
            print(f"TEST {i}: {question}")
            print('─'*80)
            
            # Run hybrid retrieval
            results = hybrid_retrieve_chunks(
                chunk_db=db,
                document_ids=document_ids,
                question=question,
                top_k=3,  # Get top 3 chunks per document
                use_reranking=True
            )
            
            # Print results
            if not results:
                print("❌ No results found")
                continue
            
            print(f"\n✓ Found results in {len(results)} documents:")
            
            for doc_id, data in results.items():
                print(f"\n  📄 Doc {doc_id}: {data['doc_title']}")
                print(f"     Chunks: {len(data['chunks'])}")
                
                for j, chunk in enumerate(data['chunks'], 1):
                    score = chunk.get('score', 0)
                    page = chunk.get('start_page_num', '?')
                    section = chunk.get('section_title', 'Unknown')[:40]
                    text_preview = chunk['text'][:100].replace('\n', ' ')
                    
                    # Show which retrieval methods contributed
                    dense_score = chunk.get('dense_score', 0)
                    sparse_score = chunk.get('sparse_score', 0)
                    rerank_score = chunk.get('rerank_score', 0)
                    
                    print(f"\n     Chunk {j} (score={score:.4f}):")
                    print(f"       Page: {page} | Section: {section}")
                    print(f"       Dense: {dense_score:.4f} | Sparse: {sparse_score:.4f} | Rerank: {rerank_score:.4f}")
                    print(f"       Text: {text_preview}...")
        
        print("\n" + "="*80)
        print("✓ Hybrid retrieval test complete!")
        print("="*80)
        
    finally:
        db.close()


if __name__ == "__main__":
    test_hybrid_retrieval()
