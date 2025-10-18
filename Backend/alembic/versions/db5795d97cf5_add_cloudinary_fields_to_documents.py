"""add cloudinary fields to documents

Revision ID: db5795d97cf5
Revises: e787c29f53fb
Create Date: 2025-10-18 15:04:28.642892

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'db5795d97cf5'
down_revision: Union[str, Sequence[str], None] = 'e787c29f53fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
