"""add_last_summarized_message_id_to_chat_summaries

Revision ID: a4425adf4c77
Revises: f2a3b4c5d6e7
Create Date: 2026-04-18 17:29:20.083446

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4425adf4c77'
down_revision: Union[str, Sequence[str], None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
