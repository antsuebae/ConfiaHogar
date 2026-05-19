from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.presupuesto import EstadoPresupuesto


class PresupuestoCreate(BaseModel):
    conversacion_id: int
    importe: float
    concepto: Optional[str] = None
    presupuesto_padre_id: Optional[int] = None


class PresupuestoUpdate(BaseModel):
    estado: EstadoPresupuesto


class PresupuestoResponse(BaseModel):
    id: int
    conversacion_id: int
    remitente_id: int
    importe: float
    concepto: Optional[str]
    estado: EstadoPresupuesto
    presupuesto_padre_id: Optional[int]
    creado_en: datetime

    class Config:
        from_attributes = True
