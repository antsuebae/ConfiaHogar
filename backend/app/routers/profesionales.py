from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.models.usuario import Usuario, RolUsuario
from app.models.profesional import Profesional, Certificacion, EstadoCertificacion
from app.schemas.profesional import (
    ProfesionalUpdate, ProfesionalResponse, ProfesionalCard,
    CertificacionResponse, DatosCobro
)
from app.utils.auth import get_current_user, get_current_profesional
from app.utils.storage import upload_image, upload_document
from app.utils.geo import haversine_km

router = APIRouter(prefix="/profesionales", tags=["Profesionales"])


def _build_card(prof: Profesional, lat: float = None, lng: float = None) -> dict:
    distancia = None
    if lat and lng and prof.latitud and prof.longitud:
        distancia = round(haversine_km(lat, lng, prof.latitud, prof.longitud), 2)
    return {
        "id": prof.id,
        "usuario_id": prof.usuario_id,
        "nombre": f"{prof.usuario.nombre} {prof.usuario.apellidos or ''}".strip(),
        "profesion": prof.profesion,
        "foto_perfil_url": prof.usuario.foto_perfil_url,
        "valoracion_media": prof.valoracion_media,
        "total_resenas": prof.total_resenas,
        "tarifa_hora": prof.tarifa_hora,
        "tarifa_visita": prof.tarifa_visita,
        "ciudad": prof.ciudad,
        "verificado": prof.verificado,
        "disponible": prof.disponible,
        "disponible_urgencias": prof.disponible_urgencias or False,
        "distancia_km": distancia,
    }


@router.get("/me", response_model=ProfesionalResponse)
def get_mi_perfil_profesional(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_profesional),
):
    prof = current_user.perfil_profesional
    if not prof:
        raise HTTPException(404, "Perfil profesional no encontrado")
    result = ProfesionalResponse.model_validate(prof)
    result.nombre = f"{current_user.nombre} {current_user.apellidos or ''}".strip()
    result.foto_perfil_url = current_user.foto_perfil_url
    return result


@router.get("/buscar", response_model=List[ProfesionalCard])
def buscar_profesionales(
    profesion: Optional[str] = Query(None),
    ciudad: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radio_km: float = Query(5.0),
    precio_max: Optional[float] = Query(None),
    valoracion_min: Optional[float] = Query(None),
    urgencias: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Profesional).filter(
        Profesional.perfil_visible == True
    )
    if profesion:
        query = query.filter(Profesional.profesion.ilike(f"%{profesion}%"))
    if ciudad:
        query = query.filter(Profesional.ciudad.ilike(f"%{ciudad}%"))
    if precio_max:
        query = query.filter(
            (Profesional.tarifa_hora <= precio_max) | (Profesional.tarifa_visita <= precio_max)
        )
    if valoracion_min:
        query = query.filter(Profesional.valoracion_media >= valoracion_min)
    if urgencias:
        query = query.filter(Profesional.disponible_urgencias == True)

    profesionales = query.offset((page - 1) * limit).limit(limit).all()

    results = []
    for p in profesionales:
        card = _build_card(p, lat, lng)
        # Filtro geográfico si se proporcionan coordenadas
        if lat and lng and p.latitud and p.longitud:
            if card["distancia_km"] > radio_km:
                continue
        results.append(card)

    if lat and lng:
        results.sort(key=lambda x: x["distancia_km"] if x["distancia_km"] else 9999)

    return results


@router.get("/{profesional_id}", response_model=ProfesionalResponse)
def get_profesional(profesional_id: int, db: Session = Depends(get_db)):
    prof = db.query(Profesional).filter(Profesional.id == profesional_id).first()
    if not prof:
        raise HTTPException(404, "Profesional no encontrado")
    result = ProfesionalResponse.model_validate(prof)
    result.nombre = f"{prof.usuario.nombre} {prof.usuario.apellidos or ''}".strip()
    result.foto_perfil_url = prof.usuario.foto_perfil_url
    return result


@router.put("/me", response_model=ProfesionalResponse)
def actualizar_perfil_profesional(
    data: ProfesionalUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_profesional),
):
    prof = current_user.perfil_profesional
    if not prof:
        raise HTTPException(404, "Perfil profesional no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prof, field, value)
    db.commit()
    db.refresh(prof)
    result = ProfesionalResponse.model_validate(prof)
    result.nombre = f"{current_user.nombre} {current_user.apellidos or ''}".strip()
    result.foto_perfil_url = current_user.foto_perfil_url
    return result


@router.post("/me/verificar")
async def solicitar_verificacion(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_profesional),
):
    prof = current_user.perfil_profesional
    url = await upload_document(file, folder="verificaciones")
    prof.verificacion_pendiente = True
    prof.verificado = False
    db.commit()
    return {"mensaje": "Solicitud enviada. Un administrador revisará tu documentación en breve.", "en_revision": True}


@router.post("/me/certificaciones", response_model=CertificacionResponse)
async def subir_certificacion(
    nombre: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_profesional),
):
    prof = current_user.perfil_profesional
    url = await upload_document(file, folder="certificaciones")
    cert = Certificacion(
        profesional_id=prof.id,
        nombre=nombre,
        documento_url=url,
        estado=EstadoCertificacion.en_revision,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert


@router.post("/me/retirar")
def retirar_fondos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_profesional),
):
    from app.models.transaccion import Transaccion, MetodoPago, EstadoTransaccion
    import uuid
    prof = current_user.perfil_profesional
    if not prof:
        raise HTTPException(404, "Perfil profesional no encontrado")
    if not prof.cuenta_verificada or not prof.iban_token:
        raise HTTPException(400, "Debes configurar y verificar tus datos de cobro antes de retirar fondos")
    saldo = prof.saldo_pendiente or 0
    if saldo <= 0:
        raise HTTPException(400, "No tienes saldo disponible para retirar")

    referencia = f"RETIR-{uuid.uuid4().hex[:10].upper()}"
    prof.saldo_pendiente = 0.0
    db.commit()
    return {
        "mensaje": f"Solicitud de retirada de {saldo:.2f}€ registrada",
        "importe": saldo,
        "referencia": referencia,
        "iban_destino": prof.iban_token,
    }


@router.post("/me/datos-cobro")
def guardar_datos_cobro(
    data: DatosCobro,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_profesional),
):
    prof = current_user.perfil_profesional
    iban = data.iban.replace(" ", "").upper()
    if len(iban) < 15 or len(iban) > 34:
        raise HTTPException(400, "IBAN inválido")
    country = iban[:2]
    if country not in ["ES", "FR", "DE", "IT", "PT", "GB", "NL", "BE"]:
        raise HTTPException(400, f"IBAN de país no soportado ({country})")
    prof.iban_token = iban[:4] + "*" * (len(iban) - 8) + iban[-4:]
    prof.cuenta_verificada = True
    db.commit()
    return {"mensaje": "Datos de cobro guardados", "iban_enmascarado": prof.iban_token}
