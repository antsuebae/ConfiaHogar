"""Seed de datos de prueba para CONFIAHOGAR"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.usuario import Usuario, RolUsuario, EstadoCuenta
from app.models.profesional import Profesional
from app.utils.auth import hash_password

PROFESIONES = [
    ("Fontanero", "Especialista en instalaciones de agua y saneamiento", 35.0, 50.0, "Sevilla", "41001", 37.3886, -5.9823),
    ("Electricista", "Instalaciones eléctricas residenciales y comerciales", 40.0, 60.0, "Sevilla", "41002", 37.3900, -5.9900),
    ("Carpintero", "Muebles a medida, parquet y reformas", 30.0, 45.0, "Sevilla", "41003", 37.3850, -5.9750),
    ("Pintor", "Pintura interior y exterior, papel pintado", 25.0, 40.0, "Sevilla", "41004", 37.3800, -5.9700),
    ("Cerrajero", "Apertura de puertas, instalación de cerraduras", 50.0, 70.0, "Sevilla", "41005", 37.3950, -5.9850),
    ("Albañil", "Reformas generales, solados y alicatados", 28.0, 42.0, "Sevilla", "41006", 37.3820, -5.9800),
    ("Aire Acondicionado", "Instalación y mantenimiento de climatización", 45.0, 65.0, "Sevilla", "41007", 37.3870, -5.9780),
    ("Cristalero", "Instalación y reparación de ventanas y espejos", 35.0, 55.0, "Sevilla", "41008", 37.3840, -5.9760),
]

CLIENTES = [
    ("María", "García López", "maria.garcia@email.com"),
    ("Carlos", "Martínez Ruiz", "carlos.martinez@email.com"),
    ("Ana", "Sánchez Pérez", "ana.sanchez@email.com"),
]


def seed():
    db = SessionLocal()
    try:
        if db.query(Usuario).count() > 0:
            print("⚡ Base de datos ya tiene datos. Saltando seed.")
            return

        print("🌱 Insertando datos de prueba...")

        # Crear clientes
        for nombre, apellidos, email in CLIENTES:
            u = Usuario(
                email=email,
                hashed_password=hash_password("Test1234!"),
                nombre=nombre,
                apellidos=apellidos,
                rol=RolUsuario.cliente,
                saldo=100.0,
                estado=EstadoCuenta.activa,
            )
            db.add(u)

        # Crear profesionales
        for i, (profesion, desc, tarifa_hora, tarifa_visita, ciudad, cp, lat, lng) in enumerate(PROFESIONES):
            nombre = f"Profesional {profesion}"
            email = f"{profesion.lower().replace(' ', '_')}@confiahogar.com"
            u = Usuario(
                email=email,
                hashed_password=hash_password("Test1234!"),
                nombre=nombre,
                apellidos="Ejemplo",
                rol=RolUsuario.profesional,
                estado=EstadoCuenta.activa,
            )
            db.add(u)
            db.flush()
            prof = Profesional(
                usuario_id=u.id,
                profesion=profesion,
                descripcion_profesional=desc,
                tarifa_hora=tarifa_hora,
                tarifa_visita=tarifa_visita,
                ciudad=ciudad,
                codigo_postal=cp,
                latitud=lat,
                longitud=lng,
                radio_servicio_km=15.0,
                verificado=(i % 2 == 0),
                disponible=True,
                perfil_visible=True,
                valoracion_media=round(3.5 + (i % 3) * 0.5, 1),
                total_resenas=i * 3 + 1,
            )
            db.add(prof)

        db.commit()
        print(f"✅ Seed completado: {len(CLIENTES)} clientes, {len(PROFESIONES)} profesionales")
        print("   Email de prueba (cliente): maria.garcia@email.com / Test1234!")
        print("   Email de prueba (profesional): fontanero@confiahogar.com / Test1234!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error en seed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
