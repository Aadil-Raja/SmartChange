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
    # Check if the enum type exists
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type_t')"
    ))
    enum_exists = result.scalar()
    
    if not enum_exists:
        # If the enum doesn't exist, just create it with the correct values
        op.execute("CREATE TYPE content_type_t AS ENUM ('DOCUMENT', 'VIDEO', 'LINK', 'QUIZ')")
        return
    
    # Check if content_items table exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_items')"
    ))
    table_exists = result.scalar()
    
    if table_exists:
        # Check current enum values
        result = conn.execute(sa.text(
            "SELECT unnest(enum_range(NULL::content_type_t))::text"
        ))
        enum_values = [row[0] for row in result]
        
        # Only proceed if we need to clean up
        if 'quiz' in enum_values or len(enum_values) > 4:
            # Update any lowercase 'quiz' to 'QUIZ'
            conn.execute(sa.text(
                "UPDATE content_items SET type = 'QUIZ' WHERE type = 'quiz'"
            ))
            
            # Recreate the enum
            op.execute("ALTER TYPE content_type_t RENAME TO content_type_t_old")
            op.execute("CREATE TYPE content_type_t AS ENUM ('DOCUMENT', 'VIDEO', 'LINK', 'QUIZ')")
            op.execute("ALTER TABLE content_items ALTER COLUMN type TYPE content_type_t USING type::text::content_type_t")
            op.execute("DROP TYPE content_type_t_old")
    else:
        # No table exists, just recreate the enum
        op.execute("ALTER TYPE content_type_t RENAME TO content_type_t_old")
        op.execute("CREATE TYPE content_type_t AS ENUM ('DOCUMENT', 'VIDEO', 'LINK', 'QUIZ')")
        op.execute("DROP TYPE content_type_t_old")


def downgrade() -> None:
    """Add back the duplicate lowercase 'quiz' enum value."""
    # Recreate the enum with both values
    op.execute("ALTER TYPE content_type_t RENAME TO content_type_t_old")
    op.execute("CREATE TYPE content_type_t AS ENUM ('DOCUMENT', 'VIDEO', 'LINK', 'quiz', 'QUIZ')")
    op.execute("ALTER TABLE content_items ALTER COLUMN type TYPE content_type_t USING type::text::content_type_t")
    op.execute("DROP TYPE content_type_t_old")
