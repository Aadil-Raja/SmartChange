"""add_start_end_page_numbers_to_chunks

Revision ID: 758332d89490
Revises: b2c3d4e5f6a7
Create Date: 2026-03-29 18:40:38.198411

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '758332d89490'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new columns for physical page number range
    op.add_column('document_chunks', sa.Column('start_page_num', sa.Integer(), nullable=True))
    op.add_column('document_chunks', sa.Column('end_page_num', sa.Integer(), nullable=True))
    
    # Copy existing page_num to start_page_num and end_page_num for existing records
    op.execute('UPDATE document_chunks SET start_page_num = page_num, end_page_num = page_num WHERE page_num IS NOT NULL')


def downgrade() -> None:
    """Downgrade schema."""
    # Remove the new columns
    op.drop_column('document_chunks', 'end_page_num')
    op.drop_column('document_chunks', 'start_page_num')
