from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class EstadoCita(str, enum.Enum):
    pendiente = "pendiente"
    confirmada = "confirmada"
    en_curso = "en_curso"
    completada = "completada"
    cancelada_cliente = "cancelada_cliente"
    cancelada_profesional = "cancelada_profesional"


class Cita(Base):
    __tablename__ = "citas"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    profesional_id = Column(Integer, ForeignKey("profesionales.id"), nullable=False)

    titulo = Column(String(200))
    descripcion = Column(Text)
    fecha_inicio = Column(DateTime, nullable=False)
    fecha_fin = Column(DateTime)
    ubicacion = Column(String(500))

    estado = Column(Enum(EstadoCita), default=EstadoCita.pendiente)
    motivo_cancelacion = Column(Text)
    cancelacion_tardia = Column(Boolean, default=False)

    recordatorio_minutos = Column(Integer, nullable=True)  # minutos antes
    recordatorio_enviado = Column(Boolean, default=False)

    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    cliente = relationship("Usuario", foreign_keys=[cliente_id], back_populates="citas_cliente")
    profesional = relationship("Profesional", foreign_keys=[profesional_id], back_populates="citas")
    transaccion = relationship("Transaccion", back_populates="cita", uselist=False)
