from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from app.models.usuario import RolUsuario, EstadoCuenta


class UsuarioBase(BaseModel):
    email: EmailStr
    nombre: str
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    descripcion: Optional[str] = None


class UsuarioCreate(UsuarioBase):
    password: str
    rol: RolUsuario

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        if not any(c.isupper() for c in v):
            raise ValueError("La contraseña debe tener al menos una mayúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe tener al menos un número")
        return v


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    descripcion: Optional[str] = None


class UsuarioResponse(UsuarioBase):
    id: int
    rol: RolUsuario
    foto_perfil_url: Optional[str] = None
    estado: EstadoCuenta
    saldo: float = 0.0
    creado_en: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    recordar_sesion: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse


class CambioPasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str


class EliminarCuentaRequest(BaseModel):
    confirmacion: str  # debe ser "ELIMINAR"


class RecargaSaldoRequest(BaseModel):
    importe: float
    metodo: str = "google_pay"


class DatosPagoRequest(BaseModel):
    iban: str
    titular: str
