"""merge_description_migration

Revision ID: 88b139c983f0
Revises: 7f8b8d9cb733, g1h2i3j4k5l6
Create Date: 2026-05-12 00:11:53.623635

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '88b139c983f0'
down_revision: Union[str, Sequence[str], None] = ('7f8b8d9cb733', 'g1h2i3j4k5l6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
