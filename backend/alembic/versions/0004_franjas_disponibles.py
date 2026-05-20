"""Add franjas_disponibles table

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "franjas_disponibles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profesional_id", sa.Integer(), sa.ForeignKey("profesionales.id"), nullable=False),
        sa.Column("dia_semana", sa.Integer(), nullable=False),
        sa.Column("hora_inicio", sa.String(5), nullable=False),
        sa.Column("hora_fin", sa.String(5), nullable=False),
        sa.UniqueConstraint("profesional_id", "dia_semana", "hora_inicio", name="uq_franja_prof_dia_hora"),
    )
    op.create_index("ix_franjas_profesional", "franjas_disponibles", ["profesional_id"])
    op.add_column("citas", sa.Column("fecha_propuesta", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_table("franjas_disponibles")
    op.drop_column("citas", "fecha_propuesta")
