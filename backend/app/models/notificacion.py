from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class TipoNotificacion(str, enum.Enum):
    mensaje_nuevo = "mensaje_nuevo"
    cita_cancelada = "cita_cancelada"
    cita_confirmada = "cita_confirmada"
    presupuesto_recibido = "presupuesto_recibido"
    pago_recibido = "pago_recibido"
    resena_recibida = "resena_recibida"
    recordatorio_cita = "recordatorio_cita"
    cuenta_verificada = "cuenta_verificada"
    discrepancia_pago = "discrepancia_pago"


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tipo = Column(Enum(TipoNotificacion), nullable=False)
    titulo = Column(String(200), nullable=False)
    cuerpo = Column(Text)
    leida = Column(Boolean, default=False)
    url_destino = Column(String(500))  # para navegación al hacer clic
    creado_en = Column(DateTime, server_default=func.now())

    usuario = relationship("Usuario", back_populates="notificaciones")
