from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.usuario import Usuario, EstadoCuenta
from app.models.cita import Cita, EstadoCita
from app.schemas.usuario import UsuarioUpdate, UsuarioResponse, EliminarCuentaRequest, RecargaSaldoRequest, DatosPagoRequest
from app.utils.auth import get_current_user
from app.utils.storage import upload_image
from app.utils.validation import luhn_check

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
    tipo = getattr(data, "tipo", "iban") or "iban"

    if tipo == "tarjeta":
        numero = (data.iban or "").replace(" ", "").replace("-", "")
        if not luhn_check(numero):
            raise HTTPException(400, "Número de tarjeta inválido (dígito de control Luhn incorrecto)")
        masked = "*" * (len(numero) - 4) + numero[-4:]
        current_user.metodo_pago_token = f"CARD-{masked}"
        db.commit()
        return {"mensaje": "Tarjeta guardada", "tarjeta_enmascarada": masked}

    # IBAN path
    iban = data.iban.replace(" ", "").upper()
    if len(iban) < 15 or len(iban) > 34:
        raise HTTPException(400, "IBAN inválido")
    country = iban[:2]
    supported = ["ES", "FR", "DE", "IT", "PT", "GB", "NL", "BE"]
    if country not in supported:
        raise HTTPException(400, f"IBAN de país no soportado ({country})")
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

    # HU23/HU42 — block deletion with active appointments
    estados_activos = [EstadoCita.pendiente, EstadoCita.confirmada, EstadoCita.en_curso]
    citas_activas = db.query(Cita).filter(
        Cita.cliente_id == current_user.id,
        Cita.estado.in_(estados_activos),
    ).count()
    if citas_activas:
        raise HTTPException(400, f"Tienes {citas_activas} cita(s) activa(s). Cancélalas antes de eliminar la cuenta.")

    # HU42 — additional check for professionals: block if retained balance
    if current_user.perfil_profesional:
        prof = current_user.perfil_profesional
        if prof.saldo_pendiente and prof.saldo_pendiente > 0:
            raise HTTPException(400, f"Tienes {prof.saldo_pendiente:.2f}€ de saldo retenido. Retíralo antes de eliminar la cuenta.")
        citas_prof = db.query(Cita).filter(
            Cita.profesional_id == prof.id,
            Cita.estado.in_(estados_activos),
        ).count()
        if citas_prof:
            raise HTTPException(400, f"Tienes {citas_prof} cita(s) activa(s) como profesional. Resuélvelas antes de eliminar la cuenta.")

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
