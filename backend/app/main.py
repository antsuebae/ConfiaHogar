import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, usuarios, profesionales, citas, mensajes, presupuestos, resenas, pagos, notificaciones, facturas, admin, disponibilidad
from app.models import fecha_bloqueada as _  # noqa: F401 — ensures FechaBloqueada mapper is registered at startup


async def _worker_recordatorios():
    """HU09 — fire appointment reminders based on recordatorio_minutos."""
    from app.database import SessionLocal
    from app.models.cita import Cita, EstadoCita
    from app.models.notificacion import Notificacion, TipoNotificacion
    while True:
        await asyncio.sleep(60)
        try:
            db = SessionLocal()
            ahora = datetime.utcnow()
            citas = db.query(Cita).filter(
                Cita.recordatorio_minutos.isnot(None),
                Cita.recordatorio_enviado == False,
                Cita.estado.in_([EstadoCita.pendiente, EstadoCita.confirmada]),
            ).all()
            for cita in citas:
                disparo = cita.fecha_inicio - timedelta(minutes=cita.recordatorio_minutos)
                if disparo <= ahora <= cita.fecha_inicio:
                    notif = Notificacion(
                        usuario_id=cita.cliente_id,
                        tipo=TipoNotificacion.recordatorio_cita,
                        titulo="Recordatorio de cita",
                        cuerpo=f"Tu cita '{cita.titulo}' comienza en {cita.recordatorio_minutos} min.",
                        url_destino=f"/citas/{cita.id}",
                    )
                    db.add(notif)
                    cita.recordatorio_enviado = True
            db.commit()
        except Exception:
            pass
        finally:
            db.close()


async def _worker_liberar_congelados():
    """HU36 — release anti-fraud frozen transactions after 24h."""
    from app.database import SessionLocal
    from app.models.transaccion import Transaccion, EstadoTransaccion
    from app.models.profesional import Profesional
    while True:
        await asyncio.sleep(3600)
        try:
            db = SessionLocal()
            limite = datetime.utcnow() - timedelta(hours=24)
            txs = db.query(Transaccion).filter(
                Transaccion.estado == EstadoTransaccion.congelada,
                Transaccion.creado_en <= limite,
            ).all()
            for tx in txs:
                tx.estado = EstadoTransaccion.completada
                prof = db.query(Profesional).filter(Profesional.id == tx.profesional_id).first()
                if prof:
                    # saldo_pendiente was NOT added during freeze (intentional anti-fraud hold)
                    prof.saldo_pendiente = (prof.saldo_pendiente or 0) + tx.importe_neto
                    prof.total_servicios = (prof.total_servicios or 0) + 1
            db.commit()
        except Exception:
            pass
        finally:
            db.close()


async def _worker_recordatorios_resena():
    """HU40 — remind clients to leave a review 48h after completing a service."""
    from sqlalchemy import not_, exists
    from app.database import SessionLocal
    from app.models.cita import Cita, EstadoCita
    from app.models.resena import Resena
    from app.models.notificacion import Notificacion, TipoNotificacion
    while True:
        await asyncio.sleep(3600)  # check every hour
        try:
            db = SessionLocal()
            limite = datetime.utcnow() - timedelta(hours=48)
            # Single JOIN query: citas completadas sin reseña y sin notificación ya enviada
            resena_sub = exists().where(
                (Resena.cita_id == Cita.id) & (Resena.cliente_id == Cita.cliente_id)
            )
            notif_sub = exists().where(
                (Notificacion.usuario_id == Cita.cliente_id)
                & (Notificacion.url_destino == ("/citas/" + Cita.id.cast(str) + "/resena"))
            )
            citas = db.query(Cita).filter(
                Cita.estado == EstadoCita.completada,
                Cita.actualizado_en <= limite,
                not_(resena_sub),
                not_(notif_sub),
            ).all()
            for cita in citas:
                notif = Notificacion(
                    usuario_id=cita.cliente_id,
                    tipo=TipoNotificacion.recordatorio_cita,
                    titulo="¿Qué tal el servicio?",
                    cuerpo=f"Valora tu experiencia con el servicio '{cita.titulo or 'contratado'}'.",
                    url_destino=f"/citas/{cita.id}/resena",
                )
                db.add(notif)
            db.commit()
        except Exception:
            pass
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task1 = asyncio.create_task(_worker_recordatorios())
    task2 = asyncio.create_task(_worker_recordatorios_resena())
    task3 = asyncio.create_task(_worker_liberar_congelados())
    yield
    task1.cancel()
    task2.cancel()
    task3.cancel()


app = FastAPI(
    title="CONFIAHOGAR API",
    description="Plataforma para encontrar profesionales del hogar de confianza",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(profesionales.router)
app.include_router(citas.router)
app.include_router(mensajes.router)
app.include_router(presupuestos.router)
app.include_router(resenas.router)
app.include_router(pagos.router)
app.include_router(notificaciones.router)
app.include_router(facturas.router)
app.include_router(admin.router)
app.include_router(disponibilidad.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "CONFIAHOGAR"}
