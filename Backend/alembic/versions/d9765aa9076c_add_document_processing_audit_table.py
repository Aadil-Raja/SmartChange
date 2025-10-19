"""add_document_processing_audit_table

Revision ID: d9765aa9076c
Revises: 7c905b26c794
Create Date: 2025-10-19 14:58:11.825491

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd9765aa9076c'
down_revision: Union[str, Sequence[str], None] = '7c905b26c794'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enum types for status and stage (if they don't exist)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE processing_status AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE processing_stage AS ENUM ('QUEUED', 'LOADING', 'PREPROCESSING', 'CHUNKING', 'EMBEDDING', 'STORING', 'COMPLETED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create document_processing_audit table (if it doesn't exist)
    op.create_table(
        'document_processing_audit',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.String(length=255), nullable=False),
        sa.Column('status', postgresql.ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', name='processing_status', create_type=False), nullable=False),
        sa.Column('current_stage', postgresql.ENUM('QUEUED', 'LOADING', 'PREPROCESSING', 'CHUNKING', 'EMBEDDING', 'STORING', 'COMPLETED', name='processing_stage', create_type=False), nullable=False),
        sa.Column('queued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('chunks_created', sa.Integer(), nullable=True),
        sa.Column('pages_processed', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_stage', sa.String(length=50), nullable=True),
        sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for efficient queries
    op.create_index('ix_audit_document_id', 'document_processing_audit', ['document_id'], unique=False)
    op.create_index('ix_audit_job_id', 'document_processing_audit', ['job_id'], unique=False)
    op.create_index('ix_audit_status', 'document_processing_audit', ['status'], unique=False)
    op.create_index('ix_audit_created_at', 'document_processing_audit', ['created_at'], unique=False)
    op.create_index(op.f('ix_document_processing_audit_id'), 'document_processing_audit', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index(op.f('ix_document_processing_audit_id'), table_name='document_processing_audit')
    op.drop_index('ix_audit_created_at', table_name='document_processing_audit')
    op.drop_index('ix_audit_status', table_name='document_processing_audit')
    op.drop_index('ix_audit_job_id', table_name='document_processing_audit')
    op.drop_index('ix_audit_document_id', table_name='document_processing_audit')
    
    # Drop table
    op.drop_table('document_processing_audit')
    
    # Drop enum types
    op.execute("DROP TYPE IF EXISTS processing_stage")
    op.execute("DROP TYPE IF EXISTS processing_status")
