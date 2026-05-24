"""Add disponible_urgencias to profesionales

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("profesionales", sa.Column("disponible_urgencias", sa.Boolean(), nullable=False, server_default="false"))


def downgrade():
    op.drop_column("profesionales", "disponible_urgencias")
