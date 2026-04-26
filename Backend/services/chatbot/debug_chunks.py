"""
Debug script to show specific chunks from a document with their scores.
"""
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shared.models import DocumentChunk
from app.core.config import get_settings
from app.services.rag_service import get_embedding_for_text
import numpy as np

settings = get_settings()

# Create database connection
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# Parameters
doc_id = 49
chunk_indices = [17, 18]
question = "What are the PSL teams?"

print(f"\n{'='*80}")
print(f"CHUNK ANALYSIS FOR DOCUMENT {doc_id}")
print(f"Question: {question}")
print(f"{'='*80}\n")

# Get question embedding
question_embedding = get_embedding_for_text(question)

for chunk_idx in chunk_indices:
    # Fetch the chunk
    chunk = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == doc_id,
        DocumentChunk.chunk_index == chunk_idx
    ).first()
    
    if not chunk:
        print(f"Chunk #{chunk_idx}: NOT FOUND\n")
        continue
    
    # Calculate dense score (cosine similarity)
    if chunk.embedding:
        chunk_embedding = np.array(chunk.embedding)
        dense_score = float(np.dot(question_embedding, chunk_embedding))
    else:
        dense_score = 0.0
    
    print(f"Chunk #{chunk_idx}")
    print(f"  Page: {chunk.start_page_num}")
    print(f"  Section: {chunk.section_title}")
    print(f"  Dense Score (Cosine Similarity): {dense_score:.4f}")
    print(f"  Text Preview: {chunk.text[:200].replace(chr(10), ' ')}...")
    print(f"\n  Full Text:")
    print(f"  {'-'*76}")
    for line in chunk.text.split('\n'):
        print(f"  {line}")
    print(f"  {'-'*76}\n")

db.close()
