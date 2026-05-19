from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.usuario import Usuario, EstadoCuenta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

MAX_INTENTOS = 5
BLOQUEO_MINUTOS = 15


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.estado == EstadoCuenta.baneada:
        raise HTTPException(status_code=403, detail="Cuenta baneada")
    if user.estado == EstadoCuenta.eliminada:
        raise HTTPException(status_code=403, detail="Cuenta eliminada")
    return user


def get_current_cliente(user: Usuario = Depends(get_current_user)) -> Usuario:
    from app.models.usuario import RolUsuario
    if user.rol != RolUsuario.cliente:
        raise HTTPException(status_code=403, detail="Solo clientes pueden realizar esta acción")
    return user


def get_current_profesional(user: Usuario = Depends(get_current_user)) -> Usuario:
    from app.models.usuario import RolUsuario
    if user.rol != RolUsuario.profesional:
        raise HTTPException(status_code=403, detail="Solo profesionales pueden realizar esta acción")
    return user
