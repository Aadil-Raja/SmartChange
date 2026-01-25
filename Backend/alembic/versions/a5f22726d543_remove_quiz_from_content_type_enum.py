"""remove_quiz_from_content_type_enum

Revision ID: a5f22726d543
Revises: fa3a9ce687c9
Create Date: 2026-01-25 15:52:08.510601

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5f22726d543'
down_revision: Union[str, Sequence[str], None] = 'fa3a9ce687c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove QUIZ from content_type_t enum since quizzes are now directly linked to courses."""
    # Remove the QUIZ enum value
    op.execute("ALTER TYPE content_type_t RENAME TO content_type_t_old")
    op.execute("CREATE TYPE content_type_t AS ENUM ('DOCUMENT', 'VIDEO', 'LINK')")
    op.execute("ALTER TABLE content_items ALTER COLUMN type TYPE content_type_t USING type::text::content_type_t")
    op.execute("DROP TYPE content_type_t_old")


def downgrade() -> None:
    """Add back QUIZ to content_type_t enum."""
    # Add back the QUIZ enum value
    op.execute("ALTER TYPE content_type_t RENAME TO content_type_t_old")
    op.execute("CREATE TYPE content_type_t AS ENUM ('DOCUMENT', 'VIDEO', 'LINK', 'QUIZ')")
    op.execute("ALTER TABLE content_items ALTER COLUMN type TYPE content_type_t USING type::text::content_type_t")
    op.execute("DROP TYPE content_type_t_old")
