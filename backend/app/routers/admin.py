from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.usuario import Usuario
from app.models.profesional import Profesional, Certificacion, EstadoCertificacion
from app.models.notificacion import Notificacion, TipoNotificacion
from app.utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])

ADMIN_EMAIL = "admin@confiahogar.com"


def _require_admin(current_user: Usuario = Depends(get_current_user)):
    if current_user.email != ADMIN_EMAIL:
        raise HTTPException(403, "Acceso restringido al administrador")
    return current_user


# ─── Verificaciones ───────────────────────────────────────────────────────────

@router.get("/verificaciones")
def listar_verificaciones_pendientes(
    db: Session = Depends(get_db),
    _: Usuario = Depends(_require_admin),
):
    profs = db.query(Profesional).filter(Profesional.verificacion_pendiente == True).all()
    return [
        {
            "profesional_id": p.id,
            "usuario_id": p.usuario_id,
            "nombre": f"{p.usuario.nombre} {p.usuario.apellidos or ''}".strip(),
            "email": p.usuario.email,
            "profesion": p.profesion,
            "ciudad": p.ciudad,
            "verificado": p.verificado,
            "verificacion_pendiente": p.verificacion_pendiente,
        }
        for p in profs
    ]


@router.post("/verificaciones/{profesional_id}/aprobar")
def aprobar_verificacion(
    profesional_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_require_admin),
):
    prof = db.query(Profesional).filter(Profesional.id == profesional_id).first()
    if not prof:
        raise HTTPException(404, "Profesional no encontrado")
    prof.verificado = True
    prof.verificacion_pendiente = False
    notif = Notificacion(
        usuario_id=prof.usuario_id,
        tipo=TipoNotificacion.cuenta_verificada,
        titulo="¡Verificación aprobada!",
        cuerpo="Tu perfil ha sido verificado por el equipo de CONFIAHOGAR. Ya puedes mostrar la insignia verificado.",
        url_destino="/profesional/perfil",
    )
    db.add(notif)
    db.commit()
    return {"mensaje": "Verificación aprobada", "profesional_id": profesional_id}


@router.post("/verificaciones/{profesional_id}/rechazar")
def rechazar_verificacion(
    profesional_id: int,
    motivo: str = "Documentación insuficiente",
    db: Session = Depends(get_db),
    _: Usuario = Depends(_require_admin),
):
    prof = db.query(Profesional).filter(Profesional.id == profesional_id).first()
    if not prof:
        raise HTTPException(404, "Profesional no encontrado")
    prof.verificado = False
    prof.verificacion_pendiente = False
    notif = Notificacion(
        usuario_id=prof.usuario_id,
        tipo=TipoNotificacion.cuenta_verificada,
        titulo="Verificación rechazada",
        cuerpo=f"Tu solicitud de verificación ha sido rechazada. Motivo: {motivo}",
        url_destino="/profesional/perfil",
    )
    db.add(notif)
    db.commit()
    return {"mensaje": "Verificación rechazada", "profesional_id": profesional_id}


# ─── Certificaciones ──────────────────────────────────────────────────────────

@router.get("/certificaciones")
def listar_certificaciones_pendientes(
    db: Session = Depends(get_db),
    _: Usuario = Depends(_require_admin),
):
    certs = db.query(Certificacion).filter(
        Certificacion.estado == EstadoCertificacion.en_revision
    ).all()
    return [
        {
            "id": c.id,
            "profesional_id": c.profesional_id,
            "nombre_profesional": f"{c.profesional.usuario.nombre} {c.profesional.usuario.apellidos or ''}".strip() if c.profesional and c.profesional.usuario else "",
            "nombre": c.nombre,
            "documento_url": c.documento_url,
            "estado": c.estado,
            "creado_en": c.creado_en,
        }
        for c in certs
    ]


@router.post("/certificaciones/{cert_id}/aprobar")
def aprobar_certificacion(
    cert_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_require_admin),
):
    cert = db.query(Certificacion).filter(Certificacion.id == cert_id).first()
    if not cert:
        raise HTTPException(404, "Certificación no encontrada")
    cert.estado = EstadoCertificacion.aprobada
    if cert.profesional:
        notif = Notificacion(
            usuario_id=cert.profesional.usuario_id,
            tipo=TipoNotificacion.cuenta_verificada,
            titulo="Certificación aprobada",
            cuerpo=f"Tu certificación '{cert.nombre}' ha sido aprobada y ya aparece en tu perfil.",
            url_destino="/profesional/perfil",
        )
        db.add(notif)
    db.commit()
    return {"mensaje": "Certificación aprobada", "cert_id": cert_id}


@router.post("/certificaciones/{cert_id}/rechazar")
def rechazar_certificacion(
    cert_id: int,
    motivo: str = "Documento no válido",
    db: Session = Depends(get_db),
    _: Usuario = Depends(_require_admin),
):
    cert = db.query(Certificacion).filter(Certificacion.id == cert_id).first()
    if not cert:
        raise HTTPException(404, "Certificación no encontrada")
    cert.estado = EstadoCertificacion.rechazada
    cert.motivo_rechazo = motivo
    if cert.profesional:
        notif = Notificacion(
            usuario_id=cert.profesional.usuario_id,
            tipo=TipoNotificacion.cuenta_verificada,
            titulo="Certificación rechazada",
            cuerpo=f"Tu certificación '{cert.nombre}' ha sido rechazada. Motivo: {motivo}",
            url_destino="/profesional/perfil",
        )
        db.add(notif)
    db.commit()
    return {"mensaje": "Certificación rechazada", "cert_id": cert_id}
