from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class EstadoCertificacion(str, enum.Enum):
    en_revision = "en_revision"
    aprobada = "aprobada"
    rechazada = "rechazada"
    caducada = "caducada"


class Profesional(Base):
    __tablename__ = "profesionales"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), unique=True, nullable=False)

    profesion = Column(String(100), nullable=False)
    descripcion_profesional = Column(Text)
    tarifa_hora = Column(Float)
    tarifa_visita = Column(Float)

    # Ubicación
    ciudad = Column(String(100))
    codigo_postal = Column(String(10))
    latitud = Column(Float)
    longitud = Column(Float)
    radio_servicio_km = Column(Float, default=10.0)

    # Estado
    verificado = Column(Boolean, default=False)
    verificacion_pendiente = Column(Boolean, default=False)
    perfil_visible = Column(Boolean, default=True)
    disponible = Column(Boolean, default=True)

    # Cuenta bancaria tokenizada
    iban_token = Column(String(500))
    cuenta_verificada = Column(Boolean, default=False)

    # Métricas
    valoracion_media = Column(Float, default=0.0)
    total_resenas = Column(Integer, default=0)
    total_servicios = Column(Integer, default=0)

    # Saldo acumulado
    saldo_pendiente = Column(Float, default=0.0)
    comision_plataforma = Column(Float, default=0.10)  # 10%

    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    usuario = relationship("Usuario", back_populates="perfil_profesional")
    certificaciones = relationship("Certificacion", back_populates="profesional", cascade="all, delete-orphan")
    citas = relationship("Cita", foreign_keys="Cita.profesional_id", back_populates="profesional")
    resenas_recibidas = relationship("Resena", foreign_keys="Resena.profesional_id", back_populates="profesional")
    conversaciones = relationship("Conversacion", foreign_keys="Conversacion.profesional_id", back_populates="profesional")
    franjas = relationship("FranjaDisponible", back_populates="profesional", cascade="all, delete-orphan")


class Certificacion(Base):
    __tablename__ = "certificaciones"

    id = Column(Integer, primary_key=True, index=True)
    profesional_id = Column(Integer, ForeignKey("profesionales.id"), nullable=False)
    nombre = Column(String(200), nullable=False)
    documento_url = Column(String(500))
    estado = Column(Enum(EstadoCertificacion), default=EstadoCertificacion.en_revision)
    motivo_rechazo = Column(Text)
    fecha_caducidad = Column(DateTime, nullable=True)
    creado_en = Column(DateTime, server_default=func.now())

    profesional = relationship("Profesional", back_populates="certificaciones")
