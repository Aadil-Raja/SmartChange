"""add chat_summaries table

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
Create Date: 2026-04-16 22:30:18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e1f2a3b4c5d6'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'chat_summaries',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('chathead_id', sa.BigInteger(), nullable=False),
        sa.Column('doc_id', sa.BigInteger(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['chathead_id'], ['chatheads.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chathead_id', 'doc_id', name='uq_chathead_doc')
    )
    op.create_index('ix_chat_summaries_chathead_id', 'chat_summaries', ['chathead_id'])
    op.create_index('ix_chat_summaries_doc_id', 'chat_summaries', ['doc_id'])


def downgrade():
    op.drop_index('ix_chat_summaries_doc_id', table_name='chat_summaries')
    op.drop_index('ix_chat_summaries_chathead_id', table_name='chat_summaries')
    op.drop_table('chat_summaries')
