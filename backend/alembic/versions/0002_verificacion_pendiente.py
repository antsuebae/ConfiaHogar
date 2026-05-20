"""Add verificacion_pendiente to profesionales

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("profesionales", sa.Column("verificacion_pendiente", sa.Boolean, server_default="false"))


def downgrade():
    op.drop_column("profesionales", "verificacion_pendiente")
