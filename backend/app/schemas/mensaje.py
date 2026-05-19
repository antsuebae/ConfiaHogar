from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.mensaje import TipoMensaje


class MensajeCreate(BaseModel):
    conversacion_id: int
    tipo: TipoMensaje = TipoMensaje.texto
    contenido: Optional[str] = None


class MensajeResponse(BaseModel):
    id: int
    conversacion_id: int
    remitente_id: int
    tipo: TipoMensaje
    contenido: Optional[str]
    imagen_url: Optional[str]
    leido: bool
    creado_en: datetime

    nombre_remitente: Optional[str] = None
    foto_remitente: Optional[str] = None

    class Config:
        from_attributes = True


class ConversacionCreate(BaseModel):
    profesional_id: int


class ConversacionResponse(BaseModel):
    id: int
    cliente_id: int
    profesional_id: int
    creado_en: datetime
    actualizado_en: datetime

    nombre_cliente: Optional[str] = None
    nombre_profesional: Optional[str] = None
    foto_cliente: Optional[str] = None
    foto_profesional: Optional[str] = None
    ultimo_mensaje: Optional[str] = None
    no_leidos: int = 0

    class Config:
        from_attributes = True


class WSMessage(BaseModel):
    tipo: str  # "mensaje", "presupuesto", "notificacion", "leido"
    conversacion_id: Optional[int] = None
    datos: dict = {}
