from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.usuario import Usuario
from app.models.notificacion import Notificacion
from app.schemas.notificacion import NotificacionResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("/", response_model=List[NotificacionResponse])
def get_notificaciones(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return db.query(Notificacion).filter(
        Notificacion.usuario_id == current_user.id
    ).order_by(Notificacion.creado_en.desc()).limit(50).all()


@router.get("/no-leidas/count")
def count_no_leidas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    count = db.query(Notificacion).filter(
        Notificacion.usuario_id == current_user.id,
        Notificacion.leida == False,
    ).count()
    return {"count": count}


@router.put("/{notificacion_id}/leer")
def marcar_leida(
    notificacion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    notif = db.query(Notificacion).filter(
        Notificacion.id == notificacion_id,
        Notificacion.usuario_id == current_user.id,
    ).first()
    if notif:
        notif.leida = True
        db.commit()
    return {"ok": True}


@router.put("/leer-todas")
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    db.query(Notificacion).filter(
        Notificacion.usuario_id == current_user.id,
        Notificacion.leida == False,
    ).update({"leida": True})
    db.commit()
    return {"ok": True}
