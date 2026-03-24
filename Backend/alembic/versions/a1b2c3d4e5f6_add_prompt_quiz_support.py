"""add prompt quiz support

Revision ID: a1b2c3d4e5f6
Revises: 06f458d7e7a1
Create Date: 2026-03-24

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '06f458d7e7a1'
branch_labels = None
depends_on = None


def upgrade():
    # Add source_type enum
    op.execute("CREATE TYPE quiz_source_type AS ENUM ('DOCUMENT', 'PROMPT')")

    op.add_column('quizzes',
        sa.Column('source_type',
            sa.Enum('DOCUMENT', 'PROMPT', name='quiz_source_type', create_type=False),
            nullable=False,
            server_default='DOCUMENT'
        )
    )
    op.add_column('quizzes',
        sa.Column('prompt_text', sa.Text(), nullable=True)
    )
    # Make document_id nullable so prompt quizzes don't need one
    op.alter_column('quizzes', 'document_id', nullable=True)


def downgrade():
    op.alter_column('quizzes', 'document_id', nullable=False)
    op.drop_column('quizzes', 'prompt_text')
    op.drop_column('quizzes', 'source_type')
    op.execute("DROP TYPE quiz_source_type")
