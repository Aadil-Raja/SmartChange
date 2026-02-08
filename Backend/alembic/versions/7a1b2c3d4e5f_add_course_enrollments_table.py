"""add course enrollments table

Revision ID: 7a1b2c3d4e5f
Revises: 6b0deb6bfce3
Create Date: 2026-02-08 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1b2c3d4e5f'
down_revision: Union[str, Sequence[str], None] = '6b0deb6bfce3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create course_enrollments table
    op.create_table(
        'course_enrollments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'course_id', name='uq_user_course_enrollment')
    )
    
    # Create indexes
    op.create_index('idx_enrollments_user', 'course_enrollments', ['user_id'])
    op.create_index('idx_enrollments_course', 'course_enrollments', ['course_id'])
    op.create_index('idx_enrollments_enrolled_at', 'course_enrollments', ['enrolled_at'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index('idx_enrollments_enrolled_at', 'course_enrollments')
    op.drop_index('idx_enrollments_course', 'course_enrollments')
    op.drop_index('idx_enrollments_user', 'course_enrollments')
    
    # Drop table
    op.drop_table('course_enrollments')
