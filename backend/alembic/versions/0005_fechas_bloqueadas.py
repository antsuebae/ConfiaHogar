"""Add fechas_bloqueadas table

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "fechas_bloqueadas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profesional_id", sa.Integer(), sa.ForeignKey("profesionales.id"), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.UniqueConstraint("profesional_id", "fecha", name="uq_fecha_bloqueada"),
    )
    op.create_index("ix_fechas_bloqueadas_profesional", "fechas_bloqueadas", ["profesional_id"])


def downgrade():
    op.drop_table("fechas_bloqueadas")
