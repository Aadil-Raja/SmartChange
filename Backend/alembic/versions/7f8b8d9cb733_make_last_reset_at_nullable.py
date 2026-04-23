"""make_last_reset_at_nullable

Revision ID: 7f8b8d9cb733
Revises: 6e5c7ad72afa
Create Date: 2026-04-23 16:42:07.736983

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f8b8d9cb733'
down_revision: Union[str, Sequence[str], None] = '6e5c7ad72afa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
