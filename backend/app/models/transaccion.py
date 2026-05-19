from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class MetodoPago(str, enum.Enum):
    google_pay = "google_pay"
    efectivo = "efectivo"
    saldo_app = "saldo_app"


class EstadoTransaccion(str, enum.Enum):
    pendiente = "pendiente"
    pendiente_validacion = "pendiente_validacion"
    completada = "completada"
    congelada = "congelada"
    discrepancia = "discrepancia"
    reembolsada = "reembolsada"


class Transaccion(Base):
    __tablename__ = "transacciones"

    id = Column(Integer, primary_key=True, index=True)
    cita_id = Column(Integer, ForeignKey("citas.id"), nullable=False)
    cliente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    profesional_id = Column(Integer, ForeignKey("profesionales.id"), nullable=False)

    importe = Column(Float, nullable=False)
    comision = Column(Float, default=0.0)
    importe_neto = Column(Float)  # importe - comision

    metodo = Column(Enum(MetodoPago))
    estado = Column(Enum(EstadoTransaccion), default=EstadoTransaccion.pendiente)

    # Google Pay mock
    referencia_externa = Column(String(200))

    notas = Column(Text)

    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    cita = relationship("Cita", back_populates="transaccion")
    cliente = relationship("Usuario", foreign_keys=[cliente_id])
    profesional = relationship("Profesional", foreign_keys=[profesional_id])
