"""add token quota tables

Revision ID: a1b2c3d4e5f7
Revises: b2c3d4e5f6a7
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f7'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS user_token_quota (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            token_limit INTEGER NOT NULL,
            reset_interval_hours INTEGER NOT NULL,
            last_reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE
        )
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_user_token_quota_user_id ON user_token_quota (user_id)"
    ))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS user_token_usage (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            tokens_input INTEGER NOT NULL DEFAULT 0,
            tokens_output INTEGER NOT NULL DEFAULT 0,
            call_type VARCHAR(32) NOT NULL,
            window_start TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_token_usage_user_window ON user_token_usage (user_id, window_start)"
    ))


def downgrade():
    op.drop_index('ix_token_usage_user_window', table_name='user_token_usage')
    op.drop_table('user_token_usage')
    op.drop_index('ix_user_token_quota_user_id', table_name='user_token_quota')
    op.drop_table('user_token_quota')
