from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.database import get_db
from app.models.usuario import Usuario
from app.models.profesional import Profesional
from app.models.resena import Resena
from app.models.notificacion import Notificacion, TipoNotificacion
from app.schemas.resena import ResenaCreate, ResenaResponse, RespuestaProfesionalRequest, ReportarResenaRequest
from app.utils.auth import get_current_user, get_current_profesional
from app.utils.storage import upload_image
import re

router = APIRouter(prefix="/resenas", tags=["Reseñas"])

PALABRAS_BLOQUEADAS = ["mierda", "idiota", "estupido", "imbecil", "puta", "cabrón"]
SPAM_PATTERN = re.compile(r'(http|www\.|\.com|compra|oferta|descuento)', re.IGNORECASE)


def _check_contenido(texto: str):
    if not texto:
        return
    lower = texto.lower()
    for p in PALABRAS_BLOQUEADAS:
        if p in lower:
            raise HTTPException(400, "El texto contiene palabras no permitidas")
    if SPAM_PATTERN.search(texto):
        raise HTTPException(400, "El comentario parece spam o publicidad")


@router.post("/", response_model=ResenaResponse)
def crear_resena(
    data: ResenaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    if data.estrellas < 1:
        raise HTTPException(400, "Debes seleccionar al menos 1 estrella")

    _check_contenido(data.comentario)

    # Evitar doble voto por el mismo servicio
    servicio_uuid = f"{current_user.id}-{data.profesional_id}-{data.cita_id or 'libre'}"
    existing = db.query(Resena).filter(Resena.servicio_uuid == servicio_uuid).first()
    if existing:
        raise HTTPException(400, "Ya has valorado este servicio")

    resena = Resena(
        cliente_id=current_user.id,
        profesional_id=data.profesional_id,
        cita_id=data.cita_id,
        estrellas=data.estrellas,
        comentario=data.comentario,
        servicio_uuid=servicio_uuid,
    )
    db.add(resena)
    db.flush()

    # Recalcular valoración media del profesional
    prof = db.query(Profesional).filter(Profesional.id == data.profesional_id).first()
    if prof:
        todas = db.query(Resena).filter(
            Resena.profesional_id == data.profesional_id,
            Resena.oculta == False
        ).all()
        if todas:
            prof.valoracion_media = sum(r.estrellas for r in todas) / len(todas)
            prof.total_resenas = len(todas)

    # Notificar al profesional
    if prof:
        notif = Notificacion(
            usuario_id=prof.usuario_id,
            tipo=TipoNotificacion.resena_recibida,
            titulo="Nueva reseña recibida",
            cuerpo=f"{current_user.nombre} te ha valorado con {data.estrellas} ⭐",
            url_destino="/profesional/resenas",
        )
        db.add(notif)

    db.commit()
    db.refresh(resena)
    return {**resena.__dict__, "nombre_cliente": current_user.nombre, "foto_cliente": current_user.foto_perfil_url}


@router.get("/profesional/{profesional_id}", response_model=List[ResenaResponse])
def get_resenas(profesional_id: int, db: Session = Depends(get_db)):
    resenas = db.query(Resena).filter(
        Resena.profesional_id == profesional_id,
        Resena.oculta == False,
    ).order_by(Resena.creado_en.desc()).all()
    result = []
    for r in resenas:
        d = {**r.__dict__}
        if r.cliente:
            d["nombre_cliente"] = r.cliente.nombre
            d["foto_cliente"] = r.cliente.foto_perfil_url
        result.append(d)
    return result


@router.post("/{resena_id}/imagen")
async def subir_imagen_resena(
    resena_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    resena = db.query(Resena).filter(Resena.id == resena_id, Resena.cliente_id == current_user.id).first()
    if not resena:
        raise HTTPException(404, "Reseña no encontrada")
    url = await upload_image(file, folder="resenas")
    resena.imagen_url = url
    db.commit()
    return {"imagen_url": url}


@router.delete("/{resena_id}/imagen")
def eliminar_imagen_resena(
    resena_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    resena = db.query(Resena).filter(Resena.id == resena_id, Resena.cliente_id == current_user.id).first()
    if not resena:
        raise HTTPException(404, "Reseña no encontrada")
    resena.imagen_url = None
    db.commit()
    return {"mensaje": "Imagen eliminada"}


@router.post("/{resena_id}/responder")
def responder_resena(
    resena_id: int,
    data: RespuestaProfesionalRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_profesional),
):
    prof = current_user.perfil_profesional
    resena = db.query(Resena).filter(Resena.id == resena_id, Resena.profesional_id == prof.id).first()
    if not resena:
        raise HTTPException(404, "Reseña no encontrada")
    from datetime import datetime
    resena.respuesta_profesional = data.respuesta
    resena.fecha_respuesta = datetime.utcnow()
    db.commit()
    return {"mensaje": "Respuesta publicada"}


@router.post("/{resena_id}/reportar")
def reportar_resena(
    resena_id: int,
    data: ReportarResenaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_profesional),
):
    resena = db.query(Resena).filter(Resena.id == resena_id).first()
    if not resena:
        raise HTTPException(404, "Reseña no encontrada")
    resena.oculta = True
    resena.motivo_ocultacion = data.motivo
    db.commit()
    return {"mensaje": "Reseña reportada y ocultada pendiente de revisión"}
