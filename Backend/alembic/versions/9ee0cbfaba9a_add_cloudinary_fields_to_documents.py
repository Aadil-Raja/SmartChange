"""Add Cloudinary fields to documents

Revision ID: 9ee0cbfaba9a
Revises: db5795d97cf5
Create Date: 2025-10-18 15:20:37.845089

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ee0cbfaba9a'
down_revision: Union[str, Sequence[str], None] = 'db5795d97cf5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
