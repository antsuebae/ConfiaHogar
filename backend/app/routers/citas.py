from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.usuario import Usuario
from app.models.cita import Cita, EstadoCita, valid_transition
from app.models.notificacion import Notificacion, TipoNotificacion
from app.models.transaccion import Transaccion, MetodoPago, EstadoTransaccion
from app.schemas.cita import CitaCreate, CitaResponse, CancelacionRequest, RecordatorioRequest
from app.utils.auth import get_current_user
from app.utils.notificaciones import crear_y_notificar
from app.websocket.manager import manager


class ProponerFechaRequest(BaseModel):
    fecha_propuesta: str  # ISO datetime string

router = APIRouter(prefix="/citas", tags=["Citas"])

CANCELACION_TARDIA_HORAS = 2
PENALIZACION_PORCENTAJE = 0.50


def _aplicar_penalizacion_cancelacion(db: Session, cita: Cita) -> None:
    """Cobra al cliente el 50 % del presupuesto aceptado cuando cancela con <2h de antelación."""
    from app.models.presupuesto import Presupuesto, EstadoPresupuesto
    from app.models.mensaje import Conversacion

    conv = db.query(Conversacion).filter(
        Conversacion.cliente_id == cita.cliente_id,
        Conversacion.profesional_id == cita.profesional_id,
    ).first()
    if not conv:
        return

    presupuesto = db.query(Presupuesto).filter(
        Presupuesto.conversacion_id == conv.id,
        Presupuesto.estado.in_([EstadoPresupuesto.aceptado, EstadoPresupuesto.pagado]),
    ).order_by(Presupuesto.id.desc()).first()
    if not presupuesto:
        return

    penalizacion_importe = round(presupuesto.importe * PENALIZACION_PORCENTAJE, 2)
    comision = round(penalizacion_importe * 0.10, 2)
    neto = round(penalizacion_importe - comision, 2)

    tx = Transaccion(
        cita_id=cita.id,
        cliente_id=cita.cliente_id,
        profesional_id=cita.profesional_id,
        importe=penalizacion_importe,
        comision=comision,
        importe_neto=neto,
        metodo=MetodoPago.google_pay,
        estado=EstadoTransaccion.completada,
        notas=f"Penalización por cancelación tardía (50% de {presupuesto.importe}€)",
    )
    db.add(tx)

    prof = cita.profesional
    if prof:
        prof.saldo_pendiente = (prof.saldo_pendiente or 0) + neto


def _enrich(cita: Cita) -> dict:
    d = {
        "id": cita.id,
        "cliente_id": cita.cliente_id,
        "profesional_id": cita.profesional_id,
        "titulo": cita.titulo,
        "descripcion": cita.descripcion,
        "fecha_inicio": cita.fecha_inicio,
        "fecha_fin": cita.fecha_fin,
        "ubicacion": cita.ubicacion,
        "estado": cita.estado,
        "motivo_cancelacion": cita.motivo_cancelacion,
        "cancelacion_tardia": cita.cancelacion_tardia,
        "recordatorio_minutos": cita.recordatorio_minutos,
        "fecha_propuesta": cita.fecha_propuesta,
        "creado_en": cita.creado_en,
        "nombre_profesional": None,
        "foto_profesional": None,
        "nombre_cliente": None,
    }
    if cita.profesional and cita.profesional.usuario:
        u = cita.profesional.usuario
        d["nombre_profesional"] = f"{u.nombre} {u.apellidos or ''}".strip()
        d["foto_profesional"] = u.foto_perfil_url
    if cita.cliente:
        d["nombre_cliente"] = f"{cita.cliente.nombre} {cita.cliente.apellidos or ''}".strip()
    return d


@router.post("/", response_model=CitaResponse)
def crear_cita(
    data: CitaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = Cita(
        cliente_id=current_user.id,
        profesional_id=data.profesional_id,
        titulo=data.titulo,
        descripcion=data.descripcion,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        ubicacion=data.ubicacion,
        recordatorio_minutos=data.recordatorio_minutos,
    )
    db.add(cita)
    db.commit()
    db.refresh(cita)
    return _enrich(cita)


@router.get("/mis-citas", response_model=List[CitaResponse])
def mis_citas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    from app.models.usuario import RolUsuario
    from app.models.profesional import Profesional
    opts = [
        joinedload(Cita.profesional).joinedload(Profesional.usuario),
        joinedload(Cita.cliente),
    ]
    if current_user.rol == RolUsuario.cliente:
        citas = db.query(Cita).options(*opts).filter(Cita.cliente_id == current_user.id).all()
    else:
        prof = current_user.perfil_profesional
        citas = db.query(Cita).options(*opts).filter(Cita.profesional_id == prof.id).all() if prof else []
    return [_enrich(c) for c in citas]


def _assert_pertenece(cita: Cita, current_user: Usuario) -> None:
    from app.models.usuario import RolUsuario
    if current_user.rol == RolUsuario.cliente:
        if cita.cliente_id != current_user.id:
            raise HTTPException(403, "No tienes acceso a esta cita")
    else:
        prof = current_user.perfil_profesional
        if not prof or cita.profesional_id != prof.id:
            raise HTTPException(403, "No tienes acceso a esta cita")


@router.get("/{cita_id}", response_model=CitaResponse)
def get_cita(
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no disponible")
    _assert_pertenece(cita, current_user)
    return _enrich(cita)


@router.post("/{cita_id}/cancelar", response_model=CitaResponse)
def cancelar_cita(
    cita_id: int,
    data: CancelacionRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    from app.models.usuario import RolUsuario
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no encontrada")
    _assert_pertenece(cita, current_user)

    if cita.estado in (EstadoCita.completada, EstadoCita.cancelada_cliente, EstadoCita.cancelada_profesional):
        raise HTTPException(409, "La cita ya está en un estado terminal y no puede cancelarse")

    es_profesional = current_user.rol == RolUsuario.profesional
    ahora = datetime.utcnow()

    # Bloquear cancelación en el momento exacto del servicio (solo profesional)
    if es_profesional and cita.fecha_inicio <= ahora:
        raise HTTPException(400, "No puedes cancelar durante el servicio. Contacta con soporte.")

    # Usar fecha_propuesta si existe (el cliente aún no aceptó la nueva hora)
    fecha_ref = cita.fecha_propuesta or cita.fecha_inicio
    tardia = (fecha_ref - ahora) < timedelta(hours=CANCELACION_TARDIA_HORAS)
    cita.cancelacion_tardia = tardia
    cita.motivo_cancelacion = data.motivo
    cita.estado = EstadoCita.cancelada_profesional if es_profesional else EstadoCita.cancelada_cliente

    # Penalización por cancelación tardía del cliente (50% del presupuesto aceptado)
    if tardia and not es_profesional:
        _aplicar_penalizacion_cancelacion(db, cita)

    # Notificar a la otra parte
    destinatario_id = cita.cliente_id if es_profesional else None
    if not es_profesional and cita.profesional:
        destinatario_id = cita.profesional.usuario_id
    if destinatario_id:
        notif = Notificacion(
            usuario_id=destinatario_id,
            tipo=TipoNotificacion.cita_cancelada,
            titulo="Cita cancelada",
            cuerpo=f"La cita '{cita.titulo}' ha sido cancelada. Motivo: {data.motivo}",
            url_destino=f"/calendario",
        )
        db.add(notif)

    db.commit()
    db.refresh(cita)
    return _enrich(cita)


@router.post("/{cita_id}/confirmar", response_model=CitaResponse)
async def confirmar_cita(
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no encontrada")
    prof = current_user.perfil_profesional
    if not prof or cita.profesional_id != prof.id:
        raise HTTPException(403, "Solo el profesional puede confirmar la cita")
    if not valid_transition(cita.estado, EstadoCita.confirmada):
        raise HTTPException(409, f"No se puede confirmar una cita en estado '{cita.estado}'")
    cita.estado = EstadoCita.confirmada
    cita.fecha_propuesta = None
    db.commit()
    db.refresh(cita)
    await crear_y_notificar(
        db, cita.cliente_id, TipoNotificacion.cita_confirmada,
        "Cita confirmada",
        f"El profesional ha confirmado tu cita para el {cita.fecha_inicio.strftime('%d/%m/%Y %H:%M')}",
        f"/citas/{cita.id}",
    )
    await manager.send_to_user(cita.cliente_id, {"tipo": "cita_actualizada", "cita_id": cita.id})
    return _enrich(cita)


@router.post("/{cita_id}/proponer-fecha", response_model=CitaResponse)
async def proponer_fecha(
    cita_id: int,
    data: ProponerFechaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no encontrada")
    prof = current_user.perfil_profesional
    if not prof or cita.profesional_id != prof.id:
        raise HTTPException(403, "Solo el profesional puede proponer una fecha")
    if cita.estado not in (EstadoCita.pendiente, EstadoCita.confirmada):
        raise HTTPException(409, f"No se puede proponer fecha para una cita en estado '{cita.estado}'")
    try:
        nueva_fecha = datetime.fromisoformat(data.fecha_propuesta)
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido")
    cita.fecha_propuesta = nueva_fecha
    db.commit()
    db.refresh(cita)
    await crear_y_notificar(
        db, cita.cliente_id, TipoNotificacion.cita_confirmada,
        "El profesional propone otro horario",
        f"Nueva propuesta: {nueva_fecha.strftime('%d/%m/%Y %H:%M')}. Acepta o rechaza en tu agenda.",
        f"/citas/{cita.id}",
    )
    await manager.send_to_user(cita.cliente_id, {"tipo": "cita_actualizada", "cita_id": cita.id})
    return _enrich(cita)


@router.post("/{cita_id}/aceptar-propuesta", response_model=CitaResponse)
async def aceptar_propuesta(
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no encontrada")
    if cita.cliente_id != current_user.id:
        raise HTTPException(403, "Solo el cliente puede aceptar la propuesta")
    if not cita.fecha_propuesta:
        raise HTTPException(400, "No hay propuesta pendiente")
    cita.fecha_inicio = cita.fecha_propuesta
    cita.fecha_propuesta = None
    cita.estado = EstadoCita.confirmada
    db.commit()
    db.refresh(cita)
    prof_usuario_id = cita.profesional.usuario_id if cita.profesional else None
    if prof_usuario_id:
        await manager.send_to_user(prof_usuario_id, {"tipo": "cita_actualizada", "cita_id": cita.id})
    return _enrich(cita)


@router.post("/{cita_id}/recordatorio")
def configurar_recordatorio(
    cita_id: int,
    data: RecordatorioRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no encontrada")
    if cita.cliente_id != current_user.id:
        raise HTTPException(403, "Solo el cliente puede configurar recordatorios en su cita")
    fecha_recordatorio = cita.fecha_inicio - timedelta(minutes=data.minutos_antes)
    if fecha_recordatorio < datetime.utcnow():
        raise HTTPException(400, "No puedes programar un recordatorio en el pasado")
    cita.recordatorio_minutos = data.minutos_antes
    db.commit()
    return {"mensaje": f"Recordatorio configurado para {data.minutos_antes} minutos antes"}
