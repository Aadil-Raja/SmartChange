"""add hnsw index on document_chunks embedding

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-04-16 00:00:00.000000

Adds an HNSW index on document_chunks.embedding using cosine distance.
pgvector will automatically use this index for cosine_distance ORDER BY queries,
replacing the previous full sequential scan.

HNSW params:
  m = 16              — connections per node (higher = better recall, more memory)
  ef_construction = 64 — candidates considered during build (higher = better recall, slower build)

For search quality tuning at query time:
  SET hnsw.ef_search = 100;  (default 40, higher = better recall, slower query)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = ('b2c3d4e5f6a7', '758332d89490')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgvector HNSW has a 2000-dim limit for the `vector` type.
    # Workaround: cast to halfvec (half-precision), which supports up to 4000 dims.
    # The index is on the cast expression — no column type change needed.
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))
    bind.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
        ON document_chunks
        USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("COMMIT"))
    bind.execute(sa.text("DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx"))
