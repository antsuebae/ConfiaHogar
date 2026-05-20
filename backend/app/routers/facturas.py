from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.transaccion import Transaccion, EstadoTransaccion, MetodoPago
from app.models.usuario import Usuario
from app.utils.auth import get_current_user
from app.utils.pdf import generar_recibo_recarga, generar_factura_cobro, generar_recibo_efectivo

router = APIRouter(prefix="/facturas", tags=["Facturas"])


@router.get("/recarga/{transaccion_id}.pdf")
def descargar_recibo_recarga(
    transaccion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    tx = db.query(Transaccion).filter(
        Transaccion.id == transaccion_id,
        Transaccion.cliente_id == current_user.id,
    ).first()
    if not tx:
        raise HTTPException(404, "Transacción no encontrada")

    pdf = generar_recibo_recarga(
        importe=tx.importe,
        metodo=tx.metodo.value if tx.metodo else "google_pay",
        referencia=tx.referencia_externa or f"TX-{tx.id}",
        fecha=tx.creado_en,
        nombre_usuario=f"{current_user.nombre} {current_user.apellidos or ''}".strip(),
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=recibo-recarga-{tx.id}.pdf"},
    )


@router.get("/cobro/{transaccion_id}.pdf")
def descargar_factura_cobro(
    transaccion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    tx = db.query(Transaccion).filter(Transaccion.id == transaccion_id).first()
    if not tx:
        raise HTTPException(404, "Transacción no encontrada")
    if tx.estado != EstadoTransaccion.completada:
        raise HTTPException(400, "La factura solo está disponible para pagos completados")

    # Autorizar: cliente o profesional de la transacción
    is_cliente = tx.cliente_id == current_user.id
    is_prof = tx.profesional and tx.profesional.usuario_id == current_user.id
    if not is_cliente and not is_prof:
        raise HTTPException(403, "Sin acceso a esta factura")

    cliente = db.query(Usuario).filter(Usuario.id == tx.cliente_id).first()
    nombre_cliente = f"{cliente.nombre} {cliente.apellidos or ''}".strip() if cliente else "Cliente"
    nombre_profesional = ""
    if tx.profesional and tx.profesional.usuario:
        u = tx.profesional.usuario
        nombre_profesional = f"{u.nombre} {u.apellidos or ''}".strip()

    concepto = ""
    if tx.cita:
        concepto = tx.cita.titulo or "Servicio contratado"

    pdf = generar_factura_cobro(
        importe=tx.importe,
        comision=tx.comision,
        importe_neto=tx.importe_neto,
        referencia=tx.referencia_externa or f"TX-{tx.id}",
        fecha=tx.creado_en,
        nombre_cliente=nombre_cliente,
        nombre_profesional=nombre_profesional,
        concepto=concepto,
        metodo=tx.metodo.value if tx.metodo else "google_pay",
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=factura-{tx.id}.pdf"},
    )


@router.get("/efectivo/{transaccion_id}.pdf")
def descargar_recibo_efectivo(
    transaccion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    tx = db.query(Transaccion).filter(Transaccion.id == transaccion_id).first()
    if not tx:
        raise HTTPException(404, "Transacción no encontrada")
    if tx.estado != EstadoTransaccion.completada:
        raise HTTPException(400, "El pago aún no ha sido confirmado por ambas partes")

    is_cliente = tx.cliente_id == current_user.id
    is_prof = tx.profesional and tx.profesional.usuario_id == current_user.id
    if not is_cliente and not is_prof:
        raise HTTPException(403, "Sin acceso a este recibo")

    cliente = db.query(Usuario).filter(Usuario.id == tx.cliente_id).first()
    nombre_cliente = f"{cliente.nombre} {cliente.apellidos or ''}".strip() if cliente else "Cliente"
    nombre_profesional = ""
    if tx.profesional and tx.profesional.usuario:
        u = tx.profesional.usuario
        nombre_profesional = f"{u.nombre} {u.apellidos or ''}".strip()

    concepto = tx.cita.titulo if tx.cita else "Servicio contratado"

    pdf = generar_recibo_efectivo(
        importe=tx.importe,
        referencia=tx.referencia_externa or f"EFECT-{tx.id}",
        fecha=tx.creado_en,
        nombre_cliente=nombre_cliente,
        nombre_profesional=nombre_profesional,
        concepto=concepto or "Servicio contratado",
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=recibo-efectivo-{tx.id}.pdf"},
    )
