"""add_use_deep_reranker_to_chathead

Revision ID: g3h4i5j6k7l8
Revises: a4425adf4c77, f2a3b4c5d6e7
Create Date: 2026-04-26 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g3h4i5j6k7l8'
down_revision = ('a4425adf4c77', 'f2a3b4c5d6e7')  # Merge both heads
branch_labels = None
depends_on = None


def upgrade():
    # Add use_deep_reranker column to chatheads table
    op.add_column('chatheads', sa.Column('use_deep_reranker', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    # Remove use_deep_reranker column from chatheads table
    op.drop_column('chatheads', 'use_deep_reranker')
