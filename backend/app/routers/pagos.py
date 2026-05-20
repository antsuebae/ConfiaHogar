from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timedelta
from app.database import get_db
from app.models.usuario import Usuario
from app.models.cita import Cita, EstadoCita
from app.models.transaccion import Transaccion, MetodoPago, EstadoTransaccion
from app.models.presupuesto import Presupuesto, EstadoPresupuesto
from app.models.notificacion import Notificacion, TipoNotificacion
from app.schemas.transaccion import PagoGooglePayRequest, PagoEfectivoRequest, ConfirmarEfectivoRequest, TransaccionResponse
from app.utils.auth import get_current_user


class PagarPresupuestoRequest(BaseModel):
    fecha_inicio: Optional[str] = None

router = APIRouter(prefix="/pagos", tags=["Pagos"])

COMISION = 0.10


def _calcular_comision_y_neto(importe: float) -> tuple[float, float]:
    comision = round(importe * COMISION, 2)
    neto = round(importe - comision, 2)
    return comision, neto


@router.get("/mis-cobros", response_model=list[TransaccionResponse])
def mis_cobros(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    from app.models.profesional import Profesional
    prof = db.query(Profesional).filter(Profesional.usuario_id == current_user.id).first()
    if not prof:
        raise HTTPException(403, "Solo los profesionales pueden ver sus cobros")
    txs = db.query(Transaccion).filter(
        Transaccion.profesional_id == prof.id
    ).order_by(Transaccion.creado_en.desc()).all()
    return txs


@router.post("/google-pay", response_model=TransaccionResponse)
def pagar_google_pay(
    data: PagoGooglePayRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == data.cita_id).with_for_update().first()
    if not cita:
        raise HTTPException(404, "Cita no encontrada")
    if cita.cliente_id != current_user.id:
        raise HTTPException(403, "Solo el cliente de la cita puede realizar este pago")
    if cita.transaccion and cita.transaccion.estado == EstadoTransaccion.completada:
        raise HTTPException(400, "Esta cita ya ha sido pagada")

    referencia = f"GPAY-{uuid.uuid4().hex[:12].upper()}"
    comision, importe_neto = _calcular_comision_y_neto(data.importe)

    tx = Transaccion(
        cita_id=cita.id,
        cliente_id=current_user.id,
        profesional_id=cita.profesional_id,
        importe=data.importe,
        comision=comision,
        importe_neto=importe_neto,
        metodo=MetodoPago.google_pay,
        estado=EstadoTransaccion.completada,
        referencia_externa=referencia,
    )
    db.add(tx)
    cita.estado = EstadoCita.completada

    prof = cita.profesional
    if prof:
        prof.saldo_pendiente = (prof.saldo_pendiente or 0) + importe_neto
        prof.total_servicios = (prof.total_servicios or 0) + 1

    if prof:
        notif = Notificacion(
            usuario_id=prof.usuario_id,
            tipo=TipoNotificacion.pago_recibido,
            titulo="Pago recibido",
            cuerpo=f"Has recibido un pago de {tx.importe_neto}€ (ref: {referencia})",
            url_destino="/profesional/pagos",
        )
        db.add(notif)

    db.commit()
    db.refresh(tx)
    return tx


@router.post("/presupuesto/{presupuesto_id}", response_model=TransaccionResponse)
def pagar_presupuesto(
    presupuesto_id: int,
    body: PagarPresupuestoRequest = PagarPresupuestoRequest(),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    from app.models.mensaje import Conversacion
    from app.models.profesional import Profesional

    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).with_for_update().first()
    if not presupuesto:
        raise HTTPException(404, "Presupuesto no encontrado")
    if presupuesto.estado == EstadoPresupuesto.pagado:
        raise HTTPException(409, "Este presupuesto ya ha sido pagado")
    if presupuesto.estado != EstadoPresupuesto.aceptado:
        raise HTTPException(400, "El presupuesto debe estar aceptado antes de pagar")

    conv = db.query(Conversacion).filter(Conversacion.id == presupuesto.conversacion_id).first()
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")
    if conv.cliente_id != current_user.id:
        raise HTTPException(403, "Solo el cliente puede pagar este presupuesto")

    cita = db.query(Cita).filter(
        Cita.cliente_id == conv.cliente_id,
        Cita.profesional_id == conv.profesional_id,
        Cita.estado.in_([EstadoCita.pendiente, EstadoCita.confirmada]),
    ).first()

    if not cita:
        try:
            fecha = datetime.fromisoformat(body.fecha_inicio) if body.fecha_inicio else datetime.utcnow() + timedelta(days=1)
        except (ValueError, TypeError):
            fecha = datetime.utcnow() + timedelta(days=1)
        cita = Cita(
            cliente_id=conv.cliente_id,
            profesional_id=conv.profesional_id,
            titulo=presupuesto.concepto or "Servicio contratado",
            fecha_inicio=fecha,
        )
        db.add(cita)
        db.flush()

    referencia = f"GPAY-{uuid.uuid4().hex[:12].upper()}"
    comision, importe_neto = _calcular_comision_y_neto(presupuesto.importe)

    prof = db.query(Profesional).filter(Profesional.id == conv.profesional_id).first()
    estado_tx = EstadoTransaccion.completada
    if prof and presupuesto.importe > 200 and (prof.total_servicios or 0) < 3:
        estado_tx = EstadoTransaccion.congelada

    tx = Transaccion(
        cita_id=cita.id,
        cliente_id=current_user.id,
        profesional_id=conv.profesional_id,
        importe=presupuesto.importe,
        comision=comision,
        importe_neto=importe_neto,
        metodo=MetodoPago.google_pay,
        estado=estado_tx,
        referencia_externa=referencia,
    )
    db.add(tx)

    cita.estado = EstadoCita.completada
    presupuesto.estado = EstadoPresupuesto.pagado

    if prof and estado_tx == EstadoTransaccion.completada:
        prof.saldo_pendiente = (prof.saldo_pendiente or 0) + importe_neto
        prof.total_servicios = (prof.total_servicios or 0) + 1

    if prof:
        notif = Notificacion(
            usuario_id=prof.usuario_id,
            tipo=TipoNotificacion.pago_recibido,
            titulo="Pago recibido",
            cuerpo=f"Has recibido un pago de {tx.importe_neto}€ (ref: {referencia})",
            url_destino="/profesional/pagos",
        )
        db.add(notif)

    db.commit()
    db.refresh(tx)
    return tx


@router.post("/efectivo/cliente", response_model=TransaccionResponse)
def confirmar_efectivo_cliente(
    data: PagoEfectivoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == data.cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no encontrada")
    if cita.cliente_id != current_user.id:
        raise HTTPException(403, "Solo el cliente de la cita puede declarar pago en efectivo")

    comision, importe_neto = _calcular_comision_y_neto(data.importe)
    tx = Transaccion(
        cita_id=cita.id,
        cliente_id=current_user.id,
        profesional_id=cita.profesional_id,
        importe=data.importe,
        comision=comision,
        importe_neto=importe_neto,
        metodo=MetodoPago.efectivo,
        estado=EstadoTransaccion.pendiente_validacion,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.post("/efectivo/profesional/{transaccion_id}", response_model=TransaccionResponse)
def confirmar_efectivo_profesional(
    transaccion_id: int,
    data: ConfirmarEfectivoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    tx = db.query(Transaccion).filter(Transaccion.id == transaccion_id).first()
    if not tx:
        raise HTTPException(404, "Transacción no encontrada")
    from app.models.profesional import Profesional as _Prof
    _prof_check = db.query(_Prof).filter(_Prof.usuario_id == current_user.id).first()
    if not _prof_check or _prof_check.id != tx.profesional_id:
        raise HTTPException(403, "Solo el profesional de esta transacción puede confirmarla")

    if not data.recibido:
        tx.estado = EstadoTransaccion.discrepancia
        tx.notas = data.notas
        # Notificar administrador (simulado)
        notif = Notificacion(
            usuario_id=tx.cliente_id,
            tipo=TipoNotificacion.discrepancia_pago,
            titulo="Discrepancia de pago",
            cuerpo="El profesional indica que no ha recibido el pago. Se ha notificado al soporte.",
            url_destino="/soporte",
        )
        db.add(notif)
    else:
        tx.estado = EstadoTransaccion.completada
        cita = db.query(Cita).filter(Cita.id == tx.cita_id).first()
        if cita:
            cita.estado = EstadoCita.completada
        prof = tx.profesional
        if prof:
            prof.saldo_pendiente = (prof.saldo_pendiente or 0) + tx.importe_neto
            prof.total_servicios = (prof.total_servicios or 0) + 1

    db.commit()
    db.refresh(tx)
    return tx
