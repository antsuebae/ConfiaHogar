"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("apellidos", sa.String(150)),
        sa.Column("telefono", sa.String(20)),
        sa.Column("rol", sa.Enum("cliente", "profesional", name="rolusuario"), nullable=False),
        sa.Column("foto_perfil_url", sa.String(500)),
        sa.Column("descripcion", sa.Text),
        sa.Column("estado", sa.Enum("activa", "pausada", "baneada", "eliminada", name="estadocuenta"), default="activa"),
        sa.Column("saldo", sa.Float, default=0.0),
        sa.Column("metodo_pago_token", sa.String(500)),
        sa.Column("intentos_fallidos", sa.Integer, default=0),
        sa.Column("bloqueado_hasta", sa.DateTime, nullable=True),
        sa.Column("recordar_sesion", sa.Boolean, default=False),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_usuarios_email", "usuarios", ["email"])

    op.create_table(
        "profesionales",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("usuarios.id"), unique=True, nullable=False),
        sa.Column("profesion", sa.String(100), nullable=False),
        sa.Column("descripcion_profesional", sa.Text),
        sa.Column("tarifa_hora", sa.Float),
        sa.Column("tarifa_visita", sa.Float),
        sa.Column("ciudad", sa.String(100)),
        sa.Column("codigo_postal", sa.String(10)),
        sa.Column("latitud", sa.Float),
        sa.Column("longitud", sa.Float),
        sa.Column("radio_servicio_km", sa.Float, default=10.0),
        sa.Column("verificado", sa.Boolean, default=False),
        sa.Column("perfil_visible", sa.Boolean, default=True),
        sa.Column("disponible", sa.Boolean, default=True),
        sa.Column("iban_token", sa.String(500)),
        sa.Column("cuenta_verificada", sa.Boolean, default=False),
        sa.Column("valoracion_media", sa.Float, default=0.0),
        sa.Column("total_resenas", sa.Integer, default=0),
        sa.Column("total_servicios", sa.Integer, default=0),
        sa.Column("saldo_pendiente", sa.Float, default=0.0),
        sa.Column("comision_plataforma", sa.Float, default=0.10),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "certificaciones",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("profesional_id", sa.Integer, sa.ForeignKey("profesionales.id"), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("documento_url", sa.String(500)),
        sa.Column("estado", sa.Enum("en_revision", "aprobada", "rechazada", "caducada", name="estadocertificacion"), default="en_revision"),
        sa.Column("motivo_rechazo", sa.Text),
        sa.Column("fecha_caducidad", sa.DateTime, nullable=True),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "citas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("cliente_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("profesional_id", sa.Integer, sa.ForeignKey("profesionales.id"), nullable=False),
        sa.Column("titulo", sa.String(200)),
        sa.Column("descripcion", sa.Text),
        sa.Column("fecha_inicio", sa.DateTime, nullable=False),
        sa.Column("fecha_fin", sa.DateTime),
        sa.Column("ubicacion", sa.String(500)),
        sa.Column("estado", sa.Enum("pendiente", "confirmada", "en_curso", "completada", "cancelada_cliente", "cancelada_profesional", name="estadocita"), default="pendiente"),
        sa.Column("motivo_cancelacion", sa.Text),
        sa.Column("cancelacion_tardia", sa.Boolean, default=False),
        sa.Column("recordatorio_minutos", sa.Integer, nullable=True),
        sa.Column("recordatorio_enviado", sa.Boolean, default=False),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "conversaciones",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("cliente_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("profesional_id", sa.Integer, sa.ForeignKey("profesionales.id"), nullable=False),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "mensajes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("conversacion_id", sa.Integer, sa.ForeignKey("conversaciones.id"), nullable=False),
        sa.Column("remitente_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("tipo", sa.Enum("texto", "imagen", "presupuesto", "sistema", name="tipomensaje"), default="texto"),
        sa.Column("contenido", sa.Text),
        sa.Column("imagen_url", sa.String(500)),
        sa.Column("leido", sa.Boolean, default=False),
        sa.Column("pendiente_envio", sa.Boolean, default=False),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "presupuestos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("conversacion_id", sa.Integer, sa.ForeignKey("conversaciones.id"), nullable=False),
        sa.Column("remitente_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("importe", sa.Float, nullable=False),
        sa.Column("concepto", sa.Text),
        sa.Column("estado", sa.Enum("borrador", "enviado", "aceptado", "rechazado", "pagado", "cancelado", name="estadopresupuesto"), default="enviado"),
        sa.Column("presupuesto_padre_id", sa.Integer, sa.ForeignKey("presupuestos.id"), nullable=True),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "resenas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("cliente_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("profesional_id", sa.Integer, sa.ForeignKey("profesionales.id"), nullable=False),
        sa.Column("cita_id", sa.Integer, sa.ForeignKey("citas.id"), nullable=True),
        sa.Column("estrellas", sa.Integer, nullable=False),
        sa.Column("comentario", sa.Text),
        sa.Column("imagen_url", sa.String(500)),
        sa.Column("oculta", sa.Boolean, default=False),
        sa.Column("motivo_ocultacion", sa.Text),
        sa.Column("respuesta_profesional", sa.Text),
        sa.Column("fecha_respuesta", sa.DateTime, nullable=True),
        sa.Column("servicio_uuid", sa.String(100), unique=True),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "transacciones",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("cita_id", sa.Integer, sa.ForeignKey("citas.id"), nullable=False),
        sa.Column("cliente_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("profesional_id", sa.Integer, sa.ForeignKey("profesionales.id"), nullable=False),
        sa.Column("importe", sa.Float, nullable=False),
        sa.Column("comision", sa.Float, default=0.0),
        sa.Column("importe_neto", sa.Float),
        sa.Column("metodo", sa.Enum("google_pay", "efectivo", "saldo_app", name="metodopago")),
        sa.Column("estado", sa.Enum("pendiente", "pendiente_validacion", "completada", "congelada", "discrepancia", "reembolsada", name="estadotransaccion"), default="pendiente"),
        sa.Column("referencia_externa", sa.String(200)),
        sa.Column("notas", sa.Text),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "notificaciones",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("tipo", sa.Enum("mensaje_nuevo", "cita_cancelada", "presupuesto_recibido", "pago_recibido", "resena_recibida", "recordatorio_cita", "cuenta_verificada", "discrepancia_pago", name="tiponotificacion"), nullable=False),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("cuerpo", sa.Text),
        sa.Column("leida", sa.Boolean, default=False),
        sa.Column("url_destino", sa.String(500)),
        sa.Column("creado_en", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade():
    for table in ["notificaciones", "transacciones", "resenas", "presupuestos", "mensajes", "conversaciones", "citas", "certificaciones", "profesionales", "usuarios"]:
        op.drop_table(table)
    for enum in ["rolusuario", "estadocuenta", "estadocertificacion", "estadocita", "tipomensaje", "estadopresupuesto", "metodopago", "estadotransaccion", "tiponotificacion"]:
        sa.Enum(name=enum).drop(op.get_bind())
