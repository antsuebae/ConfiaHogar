"""Unique constraint on conversaciones(cliente_id, profesional_id)

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    # Remove duplicate rows keeping the lowest id before adding constraint
    op.execute("""
        DELETE FROM conversaciones
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM conversaciones
            GROUP BY cliente_id, profesional_id
        )
    """)
    op.create_unique_constraint("uq_conversacion_cliente_profesional", "conversaciones", ["cliente_id", "profesional_id"])


def downgrade():
    op.drop_constraint("uq_conversacion_cliente_profesional", "conversaciones", type_="unique")
