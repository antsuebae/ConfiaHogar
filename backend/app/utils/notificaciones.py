from sqlalchemy.orm import Session
from app.models.notificacion import Notificacion, TipoNotificacion
from app.websocket.manager import manager


async def crear_y_notificar(
    db: Session,
    usuario_id: int,
    tipo: TipoNotificacion,
    titulo: str,
    cuerpo: str = "",
    url_destino: str = "",
) -> Notificacion:
    notif = Notificacion(
        usuario_id=usuario_id,
        tipo=tipo,
        titulo=titulo,
        cuerpo=cuerpo,
        url_destino=url_destino,
    )
    db.add(notif)
    db.flush()
    await manager.send_to_user(usuario_id, {
        "tipo": "notificacion",
        "datos": {
            "id": notif.id,
            "tipo": tipo.value,
            "titulo": titulo,
            "cuerpo": cuerpo,
            "url_destino": url_destino,
            "leida": False,
        },
    })
    return notif
