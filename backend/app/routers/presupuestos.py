from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.usuario import Usuario
from app.models.presupuesto import Presupuesto, EstadoPresupuesto
from app.models.mensaje import Mensaje, TipoMensaje
from app.models.notificacion import Notificacion, TipoNotificacion
from app.schemas.presupuesto import PresupuestoCreate, PresupuestoResponse
from app.utils.auth import get_current_user
from app.websocket.manager import manager
import json

router = APIRouter(prefix="/presupuestos", tags=["Presupuestos"])


@router.post("/", response_model=PresupuestoResponse)
async def crear_presupuesto(
    data: PresupuestoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if data.importe <= 0:
        raise HTTPException(400, "El importe es obligatorio y debe ser mayor que 0")

    from app.models.mensaje import Conversacion
    conv = db.query(Conversacion).filter(Conversacion.id == data.conversacion_id).first()
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")

    presupuesto = Presupuesto(
        conversacion_id=data.conversacion_id,
        remitente_id=current_user.id,
        importe=data.importe,
        concepto=data.concepto,
        presupuesto_padre_id=data.presupuesto_padre_id,
    )
    db.add(presupuesto)

    # También crear mensaje de tipo presupuesto en el chat
    msg = Mensaje(
        conversacion_id=data.conversacion_id,
        remitente_id=current_user.id,
        tipo=TipoMensaje.presupuesto,
        contenido=json.dumps({"importe": data.importe, "concepto": data.concepto, "presupuesto_id": None}),
    )
    db.add(msg)
    db.flush()
    msg.contenido = json.dumps({"importe": data.importe, "concepto": data.concepto, "presupuesto_id": presupuesto.id})

    # Notificar
    if conv.cliente_id == current_user.id:
        destinatario = conv.profesional.usuario_id if conv.profesional else None
    else:
        destinatario = conv.cliente_id
    if destinatario:
        notif = Notificacion(
            usuario_id=destinatario,
            tipo=TipoNotificacion.presupuesto_recibido,
            titulo="Nuevo presupuesto recibido",
            cuerpo=f"Importe: {data.importe}€. {data.concepto or ''}",
            url_destino=f"/chat/{data.conversacion_id}",
        )
        db.add(notif)
        await manager.send_to_user(destinatario, {
            "tipo": "presupuesto",
            "conversacion_id": data.conversacion_id,
            "datos": {"importe": data.importe, "concepto": data.concepto, "presupuesto_id": presupuesto.id}
        })

    db.commit()
    db.refresh(presupuesto)
    return presupuesto


def _otro_usuario(p: Presupuesto, current_user_id: int, db: Session) -> int | None:
    from app.models.mensaje import Conversacion
    conv = db.query(Conversacion).filter(Conversacion.id == p.conversacion_id).first()
    if not conv:
        return None
    if conv.cliente_id == current_user_id:
        return conv.profesional.usuario_id if conv.profesional else None
    return conv.cliente_id


def _assert_parte_presupuesto(p: Presupuesto, current_user_id: int, db: Session) -> None:
    from app.models.mensaje import Conversacion
    conv = db.query(Conversacion).filter(Conversacion.id == p.conversacion_id).first()
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")
    prof_usuario_id = conv.profesional.usuario_id if conv.profesional else None
    if current_user_id not in (conv.cliente_id, prof_usuario_id):
        raise HTTPException(403, "No tienes acceso a este presupuesto")


@router.put("/{presupuesto_id}/aceptar", response_model=PresupuestoResponse)
async def aceptar_presupuesto(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(404, "Presupuesto no encontrado")
    _assert_parte_presupuesto(p, current_user.id, db)
    if p.remitente_id == current_user.id:
        raise HTTPException(403, "No puedes aceptar tu propio presupuesto")
    if p.estado == EstadoPresupuesto.pagado:
        raise HTTPException(400, "No puedes modificar un presupuesto ya pagado")
    p.estado = EstadoPresupuesto.aceptado
    db.commit()
    db.refresh(p)
    otro = _otro_usuario(p, current_user.id, db)
    if otro:
        await manager.send_to_user(otro, {"tipo": "presupuesto", "conversacion_id": p.conversacion_id})
    return p


@router.put("/{presupuesto_id}/rechazar", response_model=PresupuestoResponse)
async def rechazar_presupuesto(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(404, "Presupuesto no encontrado")
    _assert_parte_presupuesto(p, current_user.id, db)
    if p.remitente_id == current_user.id:
        raise HTTPException(403, "No puedes rechazar tu propio presupuesto")
    if p.estado == EstadoPresupuesto.pagado:
        raise HTTPException(400, "No puedes modificar un presupuesto ya pagado")
    p.estado = EstadoPresupuesto.rechazado
    db.commit()
    db.refresh(p)
    otro = _otro_usuario(p, current_user.id, db)
    if otro:
        await manager.send_to_user(otro, {"tipo": "presupuesto", "conversacion_id": p.conversacion_id})
    return p


@router.get("/conversacion/{conversacion_id}", response_model=List[PresupuestoResponse])
def get_presupuestos_conversacion(
    conversacion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return db.query(Presupuesto).filter(
        Presupuesto.conversacion_id == conversacion_id
    ).order_by(Presupuesto.creado_en.asc()).all()


@router.post("/{presupuesto_id}/contraofertar", response_model=PresupuestoResponse)
async def contraofertar_presupuesto(
    presupuesto_id: int,
    data: PresupuestoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    padre = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not padre:
        raise HTTPException(404, "Presupuesto no encontrado")
    if padre.estado == EstadoPresupuesto.pagado:
        raise HTTPException(400, "No puedes modificar un presupuesto ya pagado")
    if data.importe <= 0:
        raise HTTPException(400, "El importe debe ser mayor que 0")

    padre.estado = EstadoPresupuesto.rechazado

    nueva = Presupuesto(
        conversacion_id=padre.conversacion_id,
        remitente_id=current_user.id,
        importe=data.importe,
        concepto=data.concepto,
        presupuesto_padre_id=presupuesto_id,
    )
    db.add(nueva)

    msg = Mensaje(
        conversacion_id=padre.conversacion_id,
        remitente_id=current_user.id,
        tipo=TipoMensaje.presupuesto,
        contenido=json.dumps({"importe": data.importe, "concepto": data.concepto, "presupuesto_id": None}),
    )
    db.add(msg)
    db.flush()
    msg.contenido = json.dumps({"importe": data.importe, "concepto": data.concepto, "presupuesto_id": nueva.id})

    from app.models.mensaje import Conversacion
    conv = db.query(Conversacion).filter(Conversacion.id == padre.conversacion_id).first()
    if conv:
        destinatario = conv.cliente_id if conv.cliente_id != current_user.id else (
            conv.profesional.usuario_id if conv.profesional else None
        )
        if destinatario:
            notif = Notificacion(
                usuario_id=destinatario,
                tipo=TipoNotificacion.presupuesto_recibido,
                titulo="Contraoferta recibida",
                cuerpo=f"Nueva oferta de {data.importe}€. {data.concepto or ''}",
                url_destino=f"/chat/{padre.conversacion_id}",
            )
            db.add(notif)
            await manager.send_to_user(destinatario, {
                "tipo": "presupuesto",
                "conversacion_id": padre.conversacion_id,
                "datos": {"importe": data.importe, "concepto": data.concepto, "presupuesto_id": nueva.id}
            })

    db.commit()
    db.refresh(nueva)
    return nueva
