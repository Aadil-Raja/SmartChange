"""add_suggested_questions_to_documents

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-04-18

"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e2f3a4b5c6'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'documents',
        sa.Column(
            'suggested_questions',
            sa.JSON(),
            nullable=False,
            server_default='{"questions": []}',
        )
    )


def downgrade() -> None:
    op.drop_column('documents', 'suggested_questions')
