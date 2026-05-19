from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class EstadoPresupuesto(str, enum.Enum):
    borrador = "borrador"
    enviado = "enviado"
    aceptado = "aceptado"
    rechazado = "rechazado"
    pagado = "pagado"
    cancelado = "cancelado"


class Presupuesto(Base):
    __tablename__ = "presupuestos"

    id = Column(Integer, primary_key=True, index=True)
    conversacion_id = Column(Integer, ForeignKey("conversaciones.id"), nullable=False)
    remitente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    importe = Column(Float, nullable=False)
    concepto = Column(Text)
    estado = Column(Enum(EstadoPresupuesto), default=EstadoPresupuesto.enviado)

    # Negociación — historial de contraoferas
    presupuesto_padre_id = Column(Integer, ForeignKey("presupuestos.id"), nullable=True)

    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    conversacion = relationship("Conversacion")
    remitente = relationship("Usuario", foreign_keys=[remitente_id])
    contraoferta = relationship("Presupuesto", remote_side=[id])
