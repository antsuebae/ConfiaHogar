from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class TipoMensaje(str, enum.Enum):
    texto = "texto"
    imagen = "imagen"
    presupuesto = "presupuesto"
    sistema = "sistema"


class Conversacion(Base):
    __tablename__ = "conversaciones"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    profesional_id = Column(Integer, ForeignKey("profesionales.id"), nullable=False)
    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    cliente = relationship("Usuario", foreign_keys=[cliente_id], back_populates="conversaciones_cliente")
    profesional = relationship("Profesional", foreign_keys=[profesional_id], back_populates="conversaciones")
    mensajes = relationship("Mensaje", back_populates="conversacion", order_by="Mensaje.creado_en", cascade="all, delete-orphan")


class Mensaje(Base):
    __tablename__ = "mensajes"

    id = Column(Integer, primary_key=True, index=True)
    conversacion_id = Column(Integer, ForeignKey("conversaciones.id"), nullable=False)
    remitente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    tipo = Column(Enum(TipoMensaje), default=TipoMensaje.texto)
    contenido = Column(Text)
    imagen_url = Column(String(500))
    leido = Column(Boolean, default=False)
    pendiente_envio = Column(Boolean, default=False)

    creado_en = Column(DateTime, server_default=func.now())

    conversacion = relationship("Conversacion", back_populates="mensajes")
    remitente = relationship("Usuario", foreign_keys=[remitente_id])
