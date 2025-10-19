"""remove_attempt_number_from_audit

Revision ID: 22bb5dca4dca
Revises: d9765aa9076c
Create Date: 2025-10-19 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22bb5dca4dca'
down_revision: Union[str, Sequence[str], None] = 'd9765aa9076c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove attempt_number column from document_processing_audit table."""
    op.drop_column('document_processing_audit', 'attempt_number')


def downgrade() -> None:
    """Add back attempt_number column to document_processing_audit table."""
    op.add_column(
        'document_processing_audit',
        sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1')
    )
