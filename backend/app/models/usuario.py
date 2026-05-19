from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class RolUsuario(str, enum.Enum):
    cliente = "cliente"
    profesional = "profesional"


class EstadoCuenta(str, enum.Enum):
    activa = "activa"
    pausada = "pausada"
    baneada = "baneada"
    eliminada = "eliminada"


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    nombre = Column(String(100), nullable=False)
    apellidos = Column(String(150))
    telefono = Column(String(20))
    rol = Column(Enum(RolUsuario), nullable=False)
    foto_perfil_url = Column(String(500))
    descripcion = Column(Text)
    estado = Column(Enum(EstadoCuenta), default=EstadoCuenta.activa)

    # Cliente fields
    saldo = Column(Float, default=0.0)
    metodo_pago_token = Column(String(500))  # tokenizado

    # Auth
    intentos_fallidos = Column(Integer, default=0)
    bloqueado_hasta = Column(DateTime, nullable=True)
    recordar_sesion = Column(Boolean, default=False)

    creado_en = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    perfil_profesional = relationship("Profesional", back_populates="usuario", uselist=False, cascade="all, delete-orphan")
    citas_cliente = relationship("Cita", foreign_keys="Cita.cliente_id", back_populates="cliente", cascade="all, delete-orphan")
    resenas_escritas = relationship("Resena", foreign_keys="Resena.cliente_id", back_populates="cliente")
    notificaciones = relationship("Notificacion", back_populates="usuario", cascade="all, delete-orphan")
    conversaciones_cliente = relationship("Conversacion", foreign_keys="Conversacion.cliente_id", back_populates="cliente")
