# CONFIAHOGAR

Plataforma para encontrar profesionales del hogar de confianza.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 + Tailwind CSS + shadcn/ui |
| Backend | Python FastAPI + SQLAlchemy |
| Base de datos | PostgreSQL 16 |
| Almacenamiento | MinIO (S3-compatible) |
| Chat | WebSockets nativos de FastAPI |
| Auth | JWT |
| Orquestación | Docker Compose |

## Arrancar en local

### Requisitos
- Docker y Docker Compose instalados

### Pasos

```bash
# 1. Clonar y entrar al proyecto
cd proyecto

# 2. Copiar variables de entorno (opcionales, hay defaults)
cp .env.example .env

# 3. Levantar todo con un solo comando
docker compose up --build
```

Tras el arranque:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Swagger/Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (admin: minioadmin / minioadmin123)

### Usuarios de prueba (cargados automáticamente)

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Cliente | maria.garcia@email.com | Test1234! |
| Cliente | carlos.martinez@email.com | Test1234! |
| Profesional | fontanero@confiahogar.com | Test1234! |
| Profesional | electricista@confiahogar.com | Test1234! |

## Funcionalidades implementadas (46 HU)

### Cliente
- HU01 Buscar por profesión
- HU02 Ver reseñas del profesional
- HU03 Ver tarjeta del profesional
- HU04 Buscar profesional cercano (geolocalización)
- HU05 Filtrar por coste
- HU06 Filtrar por valoración
- HU07 Ver calendario
- HU08 Ver detalle de cita
- HU09 Añadir recordatorio a cita
- HU10 Cancelar cita
- HU11 Enviar texto al profesional
- HU12 Enviar imágenes al profesional
- HU13 Recibir notificaciones in-app
- HU14 Enviar presupuesto
- HU15 Negociar presupuesto
- HU16 Pagar con Google Pay (simulado)
- HU17 Confirmar pago en efectivo
- HU18 Escribir comentario en reseña
- HU19 Adjuntar imagen a reseña
- HU20 Seleccionar estrellas
- HU21 Crear cuenta
- HU22 Iniciar sesión
- HU23 Eliminar cuenta
- HU24 Modificar foto de perfil
- HU25 Modificar descripción
- HU26 Añadir fondos a la cuenta
- HU27 Añadir datos de pago

### Profesional
- HU28 Crear cuenta
- HU29 Verificar cuenta
- HU30 Ver calendario
- HU31 Cancelar cita
- HU32 Enviar imágenes al cliente
- HU33 Recibir notificaciones in-app
- HU34 Enviar texto al cliente
- HU35 Negociar presupuesto
- HU36 Cobrar con Google Pay (simulado)
- HU37 Confirmar pago en efectivo
- HU38 Ver comentario del cliente
- HU39 Ver imagen adjunta del cliente
- HU40 Ver valoración de estrellas
- HU41 Iniciar sesión
- HU42 Eliminar cuenta
- HU43 Modificar foto de perfil
- HU44 Añadir certificación
- HU45 Modificar descripción
- HU46 Añadir datos de cobro

## Estructura del proyecto

```
proyecto/
├── docker-compose.yml
├── .env.example
├── frontend/                # Next.js 14
│   └── src/
│       ├── app/             # Páginas (App Router)
│       ├── components/      # Componentes reutilizables
│       ├── hooks/           # Custom hooks (WebSocket)
│       ├── store/           # Zustand (auth, notificaciones)
│       └── types/           # TypeScript types
└── backend/                 # FastAPI
    ├── app/
    │   ├── models/          # SQLAlchemy models
    │   ├── schemas/         # Pydantic schemas
    │   ├── routers/         # API endpoints
    │   ├── utils/           # Auth, Storage, Geo
    │   └── websocket/       # WS manager
    ├── alembic/             # Migraciones BD
    └── seed.py              # Datos de prueba
```
# ConfiaHogar
