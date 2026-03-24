"""merge heads

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6, abc123def456
Create Date: 2026-03-24

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = ('a1b2c3d4e5f6', 'abc123def456')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
