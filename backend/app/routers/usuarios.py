from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario, EstadoCuenta
from app.schemas.usuario import UsuarioUpdate, UsuarioResponse, EliminarCuentaRequest, RecargaSaldoRequest, DatosPagoRequest
from app.utils.auth import get_current_user
from app.utils.storage import upload_image

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


@router.put("/me", response_model=UsuarioResponse)
def actualizar_perfil(
    data: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if data.nombre is not None:
        if len(data.nombre) > 500:
            raise HTTPException(400, "El texto supera el límite máximo de caracteres")
        current_user.nombre = data.nombre
    if data.apellidos is not None:
        current_user.apellidos = data.apellidos
    if data.telefono is not None:
        current_user.telefono = data.telefono
    if data.descripcion is not None:
        if len(data.descripcion) > 1000:
            raise HTTPException(400, "La descripción supera el límite máximo de caracteres")
        current_user.descripcion = data.descripcion
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/foto", response_model=UsuarioResponse)
async def cambiar_foto(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    url = await upload_image(file, folder="perfiles")
    current_user.foto_perfil_url = url
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/foto", response_model=UsuarioResponse)
def borrar_foto(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    current_user.foto_perfil_url = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/recargar-saldo", response_model=UsuarioResponse)
def recargar_saldo(
    data: RecargaSaldoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if data.importe <= 0:
        raise HTTPException(400, "El importe debe ser positivo")
    # Mock: simular proceso Google Pay exitoso
    current_user.saldo = (current_user.saldo or 0) + data.importe
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/datos-pago")
def guardar_datos_pago(
    data: DatosPagoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Validación básica IBAN (longitud)
    iban = data.iban.replace(" ", "").upper()
    if len(iban) < 15 or len(iban) > 34:
        raise HTTPException(400, "IBAN inválido")
    country = iban[:2]
    supported = ["ES", "FR", "DE", "IT", "PT", "GB", "NL", "BE"]
    if country not in supported:
        raise HTTPException(400, f"IBAN de país no soportado ({country})")
    # Guardar tokenizado (en prod usaríamos Stripe/etc.)
    masked = iban[:4] + "*" * (len(iban) - 8) + iban[-4:]
    current_user.metodo_pago_token = masked
    db.commit()
    return {"mensaje": "Datos de pago guardados", "iban_enmascarado": masked}


@router.delete("/me")
def eliminar_cuenta(
    data: EliminarCuentaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if data.confirmacion != "ELIMINAR":
        raise HTTPException(400, "Debes escribir 'ELIMINAR' para confirmar")
    if current_user.saldo and current_user.saldo > 0:
        raise HTTPException(400, f"Tienes {current_user.saldo}€ de saldo pendiente. Retira el dinero antes de eliminar la cuenta.")
    current_user.estado = EstadoCuenta.eliminada
    db.commit()
    return {"mensaje": "Cuenta eliminada correctamente"}


@router.put("/me/pausar")
def pausar_cuenta(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    current_user.estado = EstadoCuenta.pausada
    db.commit()
    return {"mensaje": "Cuenta pausada temporalmente"}
