from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, usuarios, profesionales, citas, mensajes, presupuestos, resenas, pagos, notificaciones

app = FastAPI(
    title="CONFIAHOGAR API",
    description="Plataforma para encontrar profesionales del hogar de confianza",
    version="1.0.0",
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


@app.get("/health")
def health():
    return {"status": "ok", "app": "CONFIAHOGAR"}
