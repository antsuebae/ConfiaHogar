from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime, timezone
from app.models.cita import EstadoCita


class CitaCreate(BaseModel):
    profesional_id: int
    titulo: str
    descripcion: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None
    ubicacion: Optional[str] = None
    recordatorio_minutos: Optional[int] = None

    @model_validator(mode="after")
    def validar_fechas(self) -> "CitaCreate":
        ahora = datetime.now(timezone.utc).replace(tzinfo=None)
        if self.fecha_inicio <= ahora:
            raise ValueError("fecha_inicio debe ser futura")
        if self.fecha_fin and self.fecha_fin <= self.fecha_inicio:
            raise ValueError("fecha_fin debe ser posterior a fecha_inicio")
        return self


class CancelacionRequest(BaseModel):
    motivo: str


class RecordatorioRequest(BaseModel):
    minutos_antes: int = Field(gt=0, le=10080)


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
    fecha_propuesta: Optional[datetime] = None
    creado_en: datetime

    nombre_profesional: Optional[str] = None
    foto_profesional: Optional[str] = None
    nombre_cliente: Optional[str] = None

    class Config:
        from_attributes = True
