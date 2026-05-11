"""add description to documents

Revision ID: g1h2i3j4k5l6
Revises: f1e2d3c4b5a6
Create Date: 2026-05-11

"""
from alembic import op
import sqlalchemy as sa

revision = 'g1h2i3j4k5l6'
down_revision = '7f8b8d9cb733'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('documents', sa.Column('description', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('documents', 'description')
