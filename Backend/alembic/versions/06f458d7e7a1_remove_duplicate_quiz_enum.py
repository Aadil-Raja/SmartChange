"""remove_duplicate_quiz_enum

Revision ID: 06f458d7e7a1
Revises: 28fa6515fb86
Create Date: 2026-01-25 15:39:54.034621

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '06f458d7e7a1'
down_revision: Union[str, Sequence[str], None] = '28fa6515fb86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove duplicate lowercase 'quiz' enum value."""
    # First, check if there are any records using the lowercase 'quiz' value
    # and update them to use 'QUIZ' instead
    op.execute("UPDATE content_items SET type = 'QUIZ' WHERE type = 'quiz'")
    
    # Remove the duplicate 'quiz' enum value
    op.execute("ALTER TYPE content_type_t RENAME TO content_type_t_old")
    op.execute("CREATE TYPE content_type_t AS ENUM ('DOCUMENT', 'VIDEO', 'LINK', 'QUIZ')")
    op.execute("ALTER TABLE content_items ALTER COLUMN type TYPE content_type_t USING type::text::content_type_t")
    op.execute("DROP TYPE content_type_t_old")


def downgrade() -> None:
    """Add back the duplicate lowercase 'quiz' enum value."""
    # Recreate the enum with both values
    op.execute("ALTER TYPE content_type_t RENAME TO content_type_t_old")
    op.execute("CREATE TYPE content_type_t AS ENUM ('DOCUMENT', 'VIDEO', 'LINK', 'quiz', 'QUIZ')")
    op.execute("ALTER TABLE content_items ALTER COLUMN type TYPE content_type_t USING type::text::content_type_t")
    op.execute("DROP TYPE content_type_t_old")
