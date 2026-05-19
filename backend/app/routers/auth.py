from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models.usuario import Usuario, RolUsuario, EstadoCuenta
from app.models.profesional import Profesional
from app.schemas.usuario import UsuarioCreate, LoginRequest, TokenResponse, UsuarioResponse
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

MAX_INTENTOS = 5
BLOQUEO_MINUTOS = 15


@router.post("/registro", response_model=TokenResponse)
def registro(data: UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == data.email).first():
        raise HTTPException(400, "Este correo ya está registrado")
    user = Usuario(
        email=data.email,
        hashed_password=hash_password(data.password),
        nombre=data.nombre,
        apellidos=data.apellidos,
        telefono=data.telefono,
        rol=data.rol,
    )
    db.add(user)
    db.flush()
    if data.rol == RolUsuario.profesional:
        prof = Profesional(usuario_id=user.id, profesion="Sin especificar", perfil_visible=False)
        db.add(prof)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, usuario=UsuarioResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == data.email).first()
    if not user:
        raise HTTPException(401, "Credenciales incorrectas")

    if user.estado == EstadoCuenta.baneada:
        raise HTTPException(403, "Cuenta suspendida temporalmente. Contacta con soporte.")

    # Comprobar bloqueo temporal
    if user.bloqueado_hasta and user.bloqueado_hasta > datetime.utcnow():
        restantes = int((user.bloqueado_hasta - datetime.utcnow()).total_seconds() / 60)
        raise HTTPException(423, f"Cuenta bloqueada. Inténtalo en {restantes} minutos.")

    if not verify_password(data.password, user.hashed_password):
        user.intentos_fallidos = (user.intentos_fallidos or 0) + 1
        if user.intentos_fallidos >= MAX_INTENTOS:
            user.bloqueado_hasta = datetime.utcnow() + timedelta(minutes=BLOQUEO_MINUTOS)
            user.intentos_fallidos = 0
            db.commit()
            raise HTTPException(423, f"Demasiados intentos. Cuenta bloqueada {BLOQUEO_MINUTOS} minutos.")
        db.commit()
        raise HTTPException(401, "Credenciales incorrectas")

    user.intentos_fallidos = 0
    user.bloqueado_hasta = None
    user.recordar_sesion = data.recordar_sesion
    db.commit()
    db.refresh(user)

    expire = timedelta(days=30) if data.recordar_sesion else None
    token = create_access_token({"sub": str(user.id)}, expires_delta=expire)
    return TokenResponse(access_token=token, usuario=UsuarioResponse.model_validate(user))


@router.get("/me", response_model=UsuarioResponse)
def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
