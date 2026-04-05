"""add_citations_to_chatmessages

Revision ID: d1e2f3a4b5c6
Revises: cc2d7dada1c1
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'cc2d7dada1c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chatmessages', sa.Column('citations', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('chatmessages', 'citations')
