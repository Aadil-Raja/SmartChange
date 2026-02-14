"""merge_heads

Revision ID: 3c2a775f5636
Revises: 4f63473c00e4, 7a1b2c3d4e5f
Create Date: 2026-02-14 22:38:01.967797

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c2a775f5636'
down_revision: Union[str, Sequence[str], None] = ('4f63473c00e4', '7a1b2c3d4e5f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
