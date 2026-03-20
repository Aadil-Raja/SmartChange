"""add document sections table

Revision ID: 56d803a82af2
Revises: a308d57826bc
Create Date: 2026-03-19 21:48:06.402796

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '56d803a82af2'
down_revision: Union[str, Sequence[str], None] = 'a308d57826bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create document_sections table
    op.create_table(
        'document_sections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('section_title', sa.String(), nullable=False),
        sa.Column('start_chunk_index', sa.Integer(), nullable=False),
        sa.Column('end_chunk_index', sa.Integer(), nullable=False),
        sa.Column('chunk_count', sa.Integer(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('summary_generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('summary_token_count', sa.Integer(), nullable=True),
        sa.Column('summary_model', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_document_sections_id', 'document_sections', ['id'], unique=False)
    op.create_index('ix_document_sections_document_id', 'document_sections', ['document_id'], unique=False)
    op.create_index('ix_doc_section_lookup', 'document_sections', ['document_id', 'section_title'], unique=False)
    op.create_index('ix_doc_section_boundaries', 'document_sections', ['document_id', 'start_chunk_index', 'end_chunk_index'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index('ix_doc_section_boundaries', table_name='document_sections')
    op.drop_index('ix_doc_section_lookup', table_name='document_sections')
    op.drop_index('ix_document_sections_document_id', table_name='document_sections')
    op.drop_index('ix_document_sections_id', table_name='document_sections')
    
    # Drop table
    op.drop_table('document_sections')
