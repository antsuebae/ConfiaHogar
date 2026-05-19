from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.profesional import EstadoCertificacion


class ProfesionalBase(BaseModel):
    profesion: str
    descripcion_profesional: Optional[str] = None
    tarifa_hora: Optional[float] = None
    tarifa_visita: Optional[float] = None
    ciudad: Optional[str] = None
    codigo_postal: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    radio_servicio_km: float = 10.0


class ProfesionalCreate(ProfesionalBase):
    pass


class ProfesionalUpdate(BaseModel):
    profesion: Optional[str] = None
    descripcion_profesional: Optional[str] = None
    tarifa_hora: Optional[float] = None
    tarifa_visita: Optional[float] = None
    ciudad: Optional[str] = None
    codigo_postal: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    radio_servicio_km: Optional[float] = None
    disponible: Optional[bool] = None
    perfil_visible: Optional[bool] = None


class CertificacionResponse(BaseModel):
    id: int
    nombre: str
    documento_url: Optional[str]
    estado: EstadoCertificacion
    motivo_rechazo: Optional[str]
    creado_en: datetime

    class Config:
        from_attributes = True


class ProfesionalResponse(ProfesionalBase):
    id: int
    usuario_id: int
    verificado: bool
    disponible: bool
    perfil_visible: bool
    valoracion_media: float
    total_resenas: int
    total_servicios: int
    saldo_pendiente: float
    certificaciones: List[CertificacionResponse] = []
    creado_en: datetime

    # Del usuario
    nombre: Optional[str] = None
    foto_perfil_url: Optional[str] = None

    class Config:
        from_attributes = True


class ProfesionalCard(BaseModel):
    id: int
    usuario_id: int
    nombre: str
    profesion: str
    foto_perfil_url: Optional[str]
    valoracion_media: float
    total_resenas: int
    tarifa_hora: Optional[float]
    tarifa_visita: Optional[float]
    ciudad: Optional[str]
    verificado: bool
    disponible: bool
    distancia_km: Optional[float] = None

    class Config:
        from_attributes = True


class BusquedaParams(BaseModel):
    profesion: Optional[str] = None
    ciudad: Optional[str] = None
    codigo_postal: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radio_km: float = 5.0
    precio_max: Optional[float] = None
    valoracion_min: Optional[float] = None
    page: int = 1
    limit: int = 20


class DatosCobro(BaseModel):
    iban: str
    titular: str
