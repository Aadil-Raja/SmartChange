"""change_active_doc_id_to_array

Revision ID: cc2d7dada1c1
Revises: e92042bc906d
Create Date: 2026-03-20 22:20:56.476644

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cc2d7dada1c1'
down_revision: Union[str, Sequence[str], None] = 'e92042bc906d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change active_doc_id from BigInteger to ARRAY(BigInteger)."""
    # Step 1: Add new column with array type
    op.add_column('chatmessages', sa.Column('active_doc_ids', sa.ARRAY(sa.BigInteger()), nullable=True))
    
    # Step 2: Migrate existing data (convert single ID to array with one element)
    op.execute("""
        UPDATE chatmessages 
        SET active_doc_ids = ARRAY[active_doc_id]
        WHERE active_doc_id IS NOT NULL
    """)
    
    # Step 3: Drop old column and its index
    op.drop_index('ix_chatmessages_active_doc_id', table_name='chatmessages')
    op.drop_column('chatmessages', 'active_doc_id')
    
    # Step 4: Create index on new column
    op.create_index('ix_chatmessages_active_doc_ids', 'chatmessages', ['active_doc_ids'], unique=False)


def downgrade() -> None:
    pass
