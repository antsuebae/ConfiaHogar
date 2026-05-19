from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.cita import EstadoCita


class CitaCreate(BaseModel):
    profesional_id: int
    titulo: str
    descripcion: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None
    ubicacion: Optional[str] = None
    recordatorio_minutos: Optional[int] = None


class CitaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    ubicacion: Optional[str] = None
    recordatorio_minutos: Optional[int] = None


class CancelacionRequest(BaseModel):
    motivo: str


class RecordatorioRequest(BaseModel):
    minutos_antes: int  # ej: 60 = 1 hora antes


class CitaResponse(BaseModel):
    id: int
    cliente_id: int
    profesional_id: int
    titulo: Optional[str]
    descripcion: Optional[str]
    fecha_inicio: datetime
    fecha_fin: Optional[datetime]
    ubicacion: Optional[str]
    estado: EstadoCita
    motivo_cancelacion: Optional[str]
    cancelacion_tardia: bool
    recordatorio_minutos: Optional[int]
    creado_en: datetime

    nombre_profesional: Optional[str] = None
    foto_profesional: Optional[str] = None
    nombre_cliente: Optional[str] = None

    class Config:
        from_attributes = True
