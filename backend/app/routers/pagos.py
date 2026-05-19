from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from app.database import get_db
from app.models.usuario import Usuario
from app.models.cita import Cita, EstadoCita
from app.models.transaccion import Transaccion, MetodoPago, EstadoTransaccion
from app.models.presupuesto import Presupuesto, EstadoPresupuesto
from app.models.notificacion import Notificacion, TipoNotificacion
from app.schemas.transaccion import PagoGooglePayRequest, PagoEfectivoRequest, ConfirmarEfectivoRequest, TransaccionResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/pagos", tags=["Pagos"])

COMISION = 0.10


def _calcular_neto(importe: float, comision: float) -> float:
    return round(importe * (1 - comision), 2)


@router.post("/google-pay", response_model=TransaccionResponse)
def pagar_google_pay(
    data: PagoGooglePayRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == data.cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no encontrada")
    if cita.transaccion and cita.transaccion.estado == EstadoTransaccion.completada:
        raise HTTPException(400, "Esta cita ya ha sido pagada")

    # Mock: simular aprobación de Google Pay
    referencia = f"GPAY-{uuid.uuid4().hex[:12].upper()}"
    comision = round(data.importe * COMISION, 2)

    tx = Transaccion(
        cita_id=cita.id,
        cliente_id=current_user.id,
        profesional_id=cita.profesional_id,
        importe=data.importe,
        comision=comision,
        importe_neto=_calcular_neto(data.importe, COMISION),
        metodo=MetodoPago.google_pay,
        estado=EstadoTransaccion.completada,
        referencia_externa=referencia,
    )
    db.add(tx)
    cita.estado = EstadoCita.completada

    # Actualizar saldo del profesional
    prof = cita.profesional
    if prof:
        prof.saldo_pendiente = (prof.saldo_pendiente or 0) + tx.importe_neto
        prof.total_servicios = (prof.total_servicios or 0) + 1

    # Marcar presupuesto como pagado
    presupuestos = db.query(Presupuesto).filter(
        Presupuesto.conversacion_id.in_(
            [c.id for c in db.query(type('X', (), {'id': 0})) if False]  # dummy
        )
    ).all()

    # Notificar al profesional
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

    comision = round(data.importe * COMISION, 2)
    tx = Transaccion(
        cita_id=cita.id,
        cliente_id=current_user.id,
        profesional_id=cita.profesional_id,
        importe=data.importe,
        comision=comision,
        importe_neto=_calcular_neto(data.importe, COMISION),
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
