"""initial_chatbot_schema

Revision ID: e92042bc906d
Revises: 
Create Date: 2026-03-20 22:16:22.835792

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e92042bc906d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial chatbot schema with active_doc_ids as array."""
    # Check if tables already exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if 'chatheads' in inspector.get_table_names():
        print("⚠️  Tables already exist. Skipping initial schema creation.")
        return
    
    # Create message_role enum
    op.execute("CREATE TYPE message_role AS ENUM ('user', 'assistant')")
    
    # Create chatheads table
    op.create_table(
        'chatheads',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_active_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chatheads_id', 'chatheads', ['id'], unique=False)
    op.create_index('ix_chatheads_user_id', 'chatheads', ['user_id'], unique=False)
    
    # Create chatmessages table with active_doc_ids as array
    op.create_table(
        'chatmessages',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('chathead_id', sa.BigInteger(), nullable=False),
        sa.Column('role', sa.Enum('user', 'assistant', name='message_role', create_type=False), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('active_doc_ids', sa.ARRAY(sa.BigInteger()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['chathead_id'], ['chatheads.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chatmessages_active_doc_ids', 'chatmessages', ['active_doc_ids'], unique=False)
    op.create_index('ix_chatmessages_id', 'chatmessages', ['id'], unique=False)
    op.create_index('ix_msg_chathead_created', 'chatmessages', ['chathead_id', 'created_at'], unique=False)


def downgrade() -> None:
    """Drop chatbot tables."""
    op.drop_index('ix_msg_chathead_created', table_name='chatmessages')
    op.drop_index('ix_chatmessages_id', table_name='chatmessages')
    op.drop_index('ix_chatmessages_active_doc_ids', table_name='chatmessages')
    op.drop_table('chatmessages')
    
    op.drop_index('ix_chatheads_user_id', table_name='chatheads')
    op.drop_index('ix_chatheads_id', table_name='chatheads')
    op.drop_table('chatheads')
    
    op.execute("DROP TYPE message_role")
