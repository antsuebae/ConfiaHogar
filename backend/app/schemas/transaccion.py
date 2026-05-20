from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.transaccion import MetodoPago, EstadoTransaccion


class PagoGooglePayRequest(BaseModel):
    cita_id: int
    importe: float = Field(gt=0, description="Importe a pagar, debe ser mayor que 0")


class PagoEfectivoRequest(BaseModel):
    cita_id: int
    importe: float = Field(gt=0, description="Importe a pagar, debe ser mayor que 0")


class ConfirmarEfectivoRequest(BaseModel):
    recibido: bool
    notas: Optional[str] = None


class TransaccionResponse(BaseModel):
    id: int
    cita_id: int
    cliente_id: int
    profesional_id: int
    importe: float
    comision: float
    importe_neto: float
    metodo: MetodoPago
    estado: EstadoTransaccion
    referencia_externa: Optional[str]
    creado_en: datetime

    class Config:
        from_attributes = True
