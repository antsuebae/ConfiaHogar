from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Resena(Base):
    __tablename__ = "resenas"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    profesional_id = Column(Integer, ForeignKey("profesionales.id"), nullable=False)
    cita_id = Column(Integer, ForeignKey("citas.id"), nullable=True)

    estrellas = Column(Integer, nullable=False)  # 1-5
    comentario = Column(Text)
    imagen_url = Column(String(500))

    # Moderación
    oculta = Column(Boolean, default=False)
    motivo_ocultacion = Column(Text)

    # Respuesta del profesional
    respuesta_profesional = Column(Text)
    fecha_respuesta = Column(DateTime, nullable=True)

    # Control de duplicados
    servicio_uuid = Column(String(100), unique=True)  # para evitar voto doble

    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    cliente = relationship("Usuario", foreign_keys=[cliente_id], back_populates="resenas_escritas")
    profesional = relationship("Profesional", foreign_keys=[profesional_id], back_populates="resenas_recibidas")
