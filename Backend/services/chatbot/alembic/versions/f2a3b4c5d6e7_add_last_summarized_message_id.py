"""add last_summarized_message_id to chat_summaries

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-04-18 10:00:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f2a3b4c5d6e7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('chat_summaries', sa.Column('last_summarized_message_id', sa.BigInteger(), nullable=True))


def downgrade():
    op.drop_column('chat_summaries', 'last_summarized_message_id')
