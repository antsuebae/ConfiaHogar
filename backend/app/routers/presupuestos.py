from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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


@router.put("/{presupuesto_id}/aceptar", response_model=PresupuestoResponse)
def aceptar_presupuesto(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(404, "Presupuesto no encontrado")
    if p.estado == EstadoPresupuesto.pagado:
        raise HTTPException(400, "No puedes modificar un presupuesto ya pagado")
    p.estado = EstadoPresupuesto.aceptado
    db.commit()
    db.refresh(p)
    return p


@router.put("/{presupuesto_id}/rechazar", response_model=PresupuestoResponse)
def rechazar_presupuesto(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(404, "Presupuesto no encontrado")
    if p.estado == EstadoPresupuesto.pagado:
        raise HTTPException(400, "No puedes modificar un presupuesto ya pagado")
    p.estado = EstadoPresupuesto.rechazado
    db.commit()
    db.refresh(p)
    return p
