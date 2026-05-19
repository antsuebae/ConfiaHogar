from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from app.database import get_db
from app.models.usuario import Usuario
from app.models.cita import Cita, EstadoCita
from app.models.notificacion import Notificacion, TipoNotificacion
from app.schemas.cita import CitaCreate, CitaUpdate, CitaResponse, CancelacionRequest, RecordatorioRequest
from app.utils.auth import get_current_user

router = APIRouter(prefix="/citas", tags=["Citas"])

CANCELACION_TARDIA_HORAS = 2


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
    from app.models.profesional import Profesional
    from app.models.usuario import RolUsuario
    if current_user.rol == RolUsuario.cliente:
        citas = db.query(Cita).filter(Cita.cliente_id == current_user.id).all()
    else:
        prof = current_user.perfil_profesional
        citas = db.query(Cita).filter(Cita.profesional_id == prof.id).all() if prof else []
    return [_enrich(c) for c in citas]


@router.get("/{cita_id}", response_model=CitaResponse)
def get_cita(
    cita_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    cita = db.query(Cita).filter(Cita.id == cita_id).first()
    if not cita:
        raise HTTPException(404, "Cita no disponible")
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

    es_profesional = current_user.rol == RolUsuario.profesional
    ahora = datetime.utcnow()

    # Bloquear cancelación en el momento exacto del servicio (solo profesional)
    if es_profesional and cita.fecha_inicio <= ahora:
        raise HTTPException(400, "No puedes cancelar durante el servicio. Contacta con soporte.")

    tardia = (cita.fecha_inicio - ahora) < timedelta(hours=CANCELACION_TARDIA_HORAS)
    cita.cancelacion_tardia = tardia
    cita.motivo_cancelacion = data.motivo
    cita.estado = EstadoCita.cancelada_profesional if es_profesional else EstadoCita.cancelada_cliente

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
    fecha_recordatorio = cita.fecha_inicio - timedelta(minutes=data.minutos_antes)
    if fecha_recordatorio < datetime.utcnow():
        raise HTTPException(400, "No puedes programar un recordatorio en el pasado")
    cita.recordatorio_minutos = data.minutos_antes
    db.commit()
    return {"mensaje": f"Recordatorio configurado para {data.minutos_antes} minutos antes"}
