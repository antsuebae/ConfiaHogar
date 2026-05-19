from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


class ResenaCreate(BaseModel):
    profesional_id: int
    cita_id: Optional[int] = None
    estrellas: int
    comentario: Optional[str] = None

    @field_validator("estrellas")
    @classmethod
    def estrellas_validas(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Las estrellas deben estar entre 1 y 5")
        return v


class RespuestaProfesionalRequest(BaseModel):
    respuesta: str


class ReportarResenaRequest(BaseModel):
    motivo: str


class ResenaResponse(BaseModel):
    id: int
    cliente_id: int
    profesional_id: int
    cita_id: Optional[int]
    estrellas: int
    comentario: Optional[str]
    imagen_url: Optional[str]
    oculta: bool
    respuesta_profesional: Optional[str]
    fecha_respuesta: Optional[datetime]
    creado_en: datetime

    nombre_cliente: Optional[str] = None
    foto_cliente: Optional[str] = None

    class Config:
        from_attributes = True
