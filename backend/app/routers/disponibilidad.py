import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import List
from datetime import date, datetime, timedelta
from app.database import get_db
from app.models.usuario import Usuario
from app.models.disponibilidad import FranjaDisponible
from app.models.fecha_bloqueada import FechaBloqueada
from app.models.cita import Cita, EstadoCita
from app.utils.auth import get_current_user

router = APIRouter(prefix="/disponibilidad", tags=["Disponibilidad"])

_HORA_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class FranjaIn(BaseModel):
    dia_semana: int   # 0=Lunes, 6=Domingo
    hora_inicio: str  # "HH:MM"
    hora_fin: str

    @field_validator("hora_inicio", "hora_fin")
    @classmethod
    def formato_hora(cls, v: str) -> str:
        if not _HORA_RE.match(v):
            raise ValueError("Formato de hora inválido (esperado HH:MM en rango 00:00-23:59)")
        return v


class FranjaOut(BaseModel):
    id: int
    dia_semana: int
    hora_inicio: str
    hora_fin: str
    class Config:
        from_attributes = True


@router.get("/profesionales/me/franjas", response_model=List[FranjaOut])
def mis_franjas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    prof = current_user.perfil_profesional
    if not prof:
        raise HTTPException(404, "Perfil profesional no encontrado")
    return db.query(FranjaDisponible).filter(FranjaDisponible.profesional_id == prof.id).order_by(
        FranjaDisponible.dia_semana, FranjaDisponible.hora_inicio
    ).all()


@router.put("/profesionales/me/franjas")
def guardar_franjas(
    franjas: List[FranjaIn],
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    prof = current_user.perfil_profesional
    if not prof:
        raise HTTPException(404, "Perfil profesional no encontrado")
    for f in franjas:
        if not (0 <= f.dia_semana <= 6):
            raise HTTPException(400, "dia_semana debe estar entre 0 (Lun) y 6 (Dom)")
        if f.hora_inicio >= f.hora_fin:
            raise HTTPException(400, "hora_inicio debe ser anterior a hora_fin. Para franja nocturna, crea dos franjas (ej: 22:00-23:59 y 00:00-02:00)")
    db.query(FranjaDisponible).filter(FranjaDisponible.profesional_id == prof.id).delete()
    for f in franjas:
        db.add(FranjaDisponible(
            profesional_id=prof.id,
            dia_semana=f.dia_semana,
            hora_inicio=f.hora_inicio,
            hora_fin=f.hora_fin,
        ))
    db.commit()
    return {"ok": True}


@router.get("/profesionales/me/fechas-bloqueadas")
def mis_fechas_bloqueadas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    prof = current_user.perfil_profesional
    if not prof:
        raise HTTPException(404, "Perfil profesional no encontrado")
    fechas = db.query(FechaBloqueada).filter(
        FechaBloqueada.profesional_id == prof.id,
        FechaBloqueada.fecha >= date.today(),
    ).order_by(FechaBloqueada.fecha).all()
    return [str(f.fecha) for f in fechas]


@router.put("/profesionales/me/fechas-bloqueadas")
def guardar_fechas_bloqueadas(
    fechas: List[str],
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    prof = current_user.perfil_profesional
    if not prof:
        raise HTTPException(404, "Perfil profesional no encontrado")
    for f in fechas:
        try:
            date.fromisoformat(f)
        except ValueError:
            raise HTTPException(400, f"Fecha inválida: {f} (formato esperado: YYYY-MM-DD)")
    db.query(FechaBloqueada).filter(
        FechaBloqueada.profesional_id == prof.id,
        FechaBloqueada.fecha >= date.today(),
    ).delete()
    for f in fechas:
        d = date.fromisoformat(f)
        if d >= date.today():
            db.add(FechaBloqueada(profesional_id=prof.id, fecha=d))
    db.commit()
    return {"ok": True}


@router.get("/profesionales/{profesional_id}/slots")
def slots_disponibles(
    profesional_id: int,
    semanas: int = 4,
    duracion_horas: int = 1,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    franjas = db.query(FranjaDisponible).filter(
        FranjaDisponible.profesional_id == profesional_id
    ).all()
    if not franjas:
        return []

    hoy = date.today()
    rango_fin = hoy + timedelta(days=semanas * 7)

    citas = db.query(Cita).filter(
        Cita.profesional_id == profesional_id,
        Cita.estado.in_([EstadoCita.pendiente, EstadoCita.confirmada, EstadoCita.en_curso]),
        Cita.fecha_inicio >= datetime(hoy.year, hoy.month, hoy.day),
        Cita.fecha_inicio <= datetime(rango_fin.year, rango_fin.month, rango_fin.day, 23, 59),
    ).all()

    ocupados: list[tuple[datetime, datetime]] = []
    for c in citas:
        fin = c.fecha_fin if c.fecha_fin else c.fecha_inicio + timedelta(hours=1)
        ocupados.append((c.fecha_inicio, fin))

    bloqueadas: set[date] = {
        f.fecha for f in db.query(FechaBloqueada).filter(
            FechaBloqueada.profesional_id == profesional_id,
            FechaBloqueada.fecha >= hoy,
            FechaBloqueada.fecha <= rango_fin,
        ).all()
    }

    slots: list[str] = []
    minimo = datetime.utcnow() + timedelta(hours=2)
    for offset in range(0, semanas * 7):
        dia = hoy + timedelta(days=offset)
        if dia in bloqueadas:
            continue
        dia_semana = dia.weekday()  # 0=Lun, 6=Dom
        for franja in franjas:
            if franja.dia_semana != dia_semana:
                continue
            ini_h, ini_m = map(int, franja.hora_inicio.split(":"))
            fin_h, fin_m = map(int, franja.hora_fin.split(":"))
            slot = datetime(dia.year, dia.month, dia.day, ini_h, ini_m)
            fin_franja = datetime(dia.year, dia.month, dia.day, fin_h, fin_m)
            duracion = timedelta(hours=max(1, duracion_horas))
            while slot + duracion <= fin_franja:
                slot_fin = slot + duracion
                if slot > minimo:
                    solapado = any(
                        inicio < slot_fin and fin > slot
                        for inicio, fin in ocupados
                    )
                    if not solapado:
                        slots.append(slot.isoformat())
                slot = slot_fin

    return slots
