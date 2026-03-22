"""change embedding dimension to 3072

Revision ID: abc123def456
Revises: 56d803a82af2
Create Date: 2026-03-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'abc123def456'
down_revision: Union[str, Sequence[str], None] = '56d803a82af2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Change embedding dimension from 768 to 3072.
    
    Strategy:
    1. Delete all existing chunks (they have 768-dim embeddings)
    2. Change column dimension to 3072
    3. Set all documents back to STORED status so they can be reprocessed
    
    This ensures clean migration without data corruption.
    """
    # Step 1: Delete all existing chunks (they have old 768-dim embeddings)
    op.execute("DELETE FROM document_chunks")
    print("✓ Deleted all existing chunks with 768-dim embeddings")
    
    # Step 2: Drop the old embedding column
    op.drop_column('document_chunks', 'embedding')
    
    # Step 3: Add new embedding column with 3072 dimensions
    op.add_column(
        'document_chunks',
        sa.Column('embedding', Vector(3072), nullable=True)
    )
    print("✓ Created new embedding column with 3072 dimensions")
    
    # Step 4: Reset all PROCESSED documents to STORED so they can be reprocessed
    op.execute("""
        UPDATE documents 
        SET status = 'STORED' 
        WHERE status = 'PROCESSED'
    """)
    print("✓ Reset all documents to STORED status for reprocessing")
    
    print("\n" + "="*80)
    print("⚠️  MIGRATION COMPLETE - ACTION REQUIRED:")
    print("="*80)
    print("1. All document chunks have been deleted")
    print("2. Embedding dimension changed from 768 to 3072")
    print("3. All documents reset to STORED status")
    print("4. YOU MUST NOW REPROCESS ALL DOCUMENTS to generate new 3072-dim embeddings")
    print("="*80 + "\n")


def downgrade() -> None:
    """
    Revert back to 768 dimensions.
    
    WARNING: This will delete all existing 3072-dim embeddings!
    """
    # Step 1: Delete all existing chunks
    op.execute("DELETE FROM document_chunks")
    print("✓ Deleted all existing chunks with 3072-dim embeddings")
    
    # Step 2: Drop the 3072 dimension column
    op.drop_column('document_chunks', 'embedding')
    
    # Step 3: Add back 768 dimension column
    op.add_column(
        'document_chunks',
        sa.Column('embedding', Vector(768), nullable=True)
    )
    print("✓ Reverted to 768 dimensions")
    
    # Step 4: Reset documents
    op.execute("""
        UPDATE documents 
        SET status = 'STORED' 
        WHERE status = 'PROCESSED'
    """)
    print("✓ Reset all documents to STORED status")
    
    print("\n⚠️  Reverted to 768 dimensions. All documents must be reprocessed!")
