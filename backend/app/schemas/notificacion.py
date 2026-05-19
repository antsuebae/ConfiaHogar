from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.notificacion import TipoNotificacion


class NotificacionResponse(BaseModel):
    id: int
    usuario_id: int
    tipo: TipoNotificacion
    titulo: str
    cuerpo: Optional[str]
    leida: bool
    url_destino: Optional[str]
    creado_en: datetime

    class Config:
        from_attributes = True
