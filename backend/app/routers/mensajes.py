from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db, SessionLocal
from app.models.usuario import Usuario
from app.models.mensaje import Conversacion, Mensaje, TipoMensaje
from app.models.notificacion import Notificacion, TipoNotificacion
from app.schemas.mensaje import ConversacionCreate, ConversacionResponse, MensajeResponse, MensajeCreate
from app.utils.auth import get_current_user, decode_token
from app.utils.storage import upload_image
from app.websocket.manager import manager

router = APIRouter(prefix="/mensajes", tags=["Mensajes"])


def _conv_response(conv: Conversacion, current_user_id: int) -> dict:
    ultimo = conv.mensajes[-1] if conv.mensajes else None
    no_leidos = sum(1 for m in conv.mensajes if not m.leido and m.remitente_id != current_user_id)
    return {
        "id": conv.id,
        "cliente_id": conv.cliente_id,
        "profesional_id": conv.profesional_id,
        "creado_en": conv.creado_en,
        "actualizado_en": conv.actualizado_en,
        "nombre_cliente": f"{conv.cliente.nombre} {conv.cliente.apellidos or ''}".strip() if conv.cliente else None,
        "nombre_profesional": f"{conv.profesional.usuario.nombre} {conv.profesional.usuario.apellidos or ''}".strip() if conv.profesional and conv.profesional.usuario else None,
        "foto_cliente": conv.cliente.foto_perfil_url if conv.cliente else None,
        "foto_profesional": conv.profesional.usuario.foto_perfil_url if conv.profesional and conv.profesional.usuario else None,
        "ultimo_mensaje": ultimo.contenido if ultimo else None,
        "no_leidos": no_leidos,
    }


@router.post("/conversaciones", response_model=ConversacionResponse)
def crear_conversacion(
    data: ConversacionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    existente = db.query(Conversacion).filter(
        Conversacion.cliente_id == current_user.id,
        Conversacion.profesional_id == data.profesional_id,
    ).first()
    if existente:
        return _conv_response(existente, current_user.id)
    conv = Conversacion(cliente_id=current_user.id, profesional_id=data.profesional_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return _conv_response(conv, current_user.id)


@router.get("/conversaciones", response_model=List[ConversacionResponse])
def mis_conversaciones(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    from app.models.usuario import RolUsuario
    if current_user.rol == RolUsuario.cliente:
        convs = db.query(Conversacion).filter(Conversacion.cliente_id == current_user.id).all()
    else:
        prof = current_user.perfil_profesional
        convs = db.query(Conversacion).filter(Conversacion.profesional_id == prof.id).all() if prof else []
    return [_conv_response(c, current_user.id) for c in convs]


@router.get("/conversaciones/{conv_id}/mensajes", response_model=List[MensajeResponse])
def get_mensajes(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    conv = db.query(Conversacion).filter(Conversacion.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")
    # Marcar como leídos
    for m in conv.mensajes:
        if m.remitente_id != current_user.id:
            m.leido = True
    db.commit()
    return [
        {
            "id": m.id,
            "conversacion_id": m.conversacion_id,
            "remitente_id": m.remitente_id,
            "tipo": m.tipo,
            "contenido": m.contenido,
            "imagen_url": m.imagen_url,
            "leido": m.leido,
            "creado_en": m.creado_en,
            "nombre_remitente": f"{m.remitente.nombre} {m.remitente.apellidos or ''}".strip() if m.remitente else None,
            "foto_remitente": m.remitente.foto_perfil_url if m.remitente else None,
        }
        for m in conv.mensajes
    ]


@router.post("/conversaciones/{conv_id}/imagen")
async def enviar_imagen(
    conv_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    conv = db.query(Conversacion).filter(Conversacion.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")
    url = await upload_image(file, folder="chat")
    msg = Mensaje(
        conversacion_id=conv_id,
        remitente_id=current_user.id,
        tipo=TipoMensaje.imagen,
        imagen_url=url,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    # Notificar vía WS
    destinatario_id = _get_destinatario(conv, current_user.id)
    await manager.send_to_user(destinatario_id, {
        "tipo": "mensaje",
        "conversacion_id": conv_id,
        "datos": {"tipo": "imagen", "imagen_url": url, "remitente_id": current_user.id}
    })
    return {"url": url, "mensaje_id": msg.id}


def _get_destinatario(conv: Conversacion, sender_id: int) -> int:
    if conv.cliente_id == sender_id:
        return conv.profesional.usuario_id if conv.profesional else 0
    return conv.cliente_id


@router.websocket("/ws/{token}")
async def websocket_chat(websocket: WebSocket, token: str):
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            raw = await websocket.receive_text()
            import json
            data = json.loads(raw)
            tipo = data.get("tipo")

            if tipo == "mensaje":
                conv_id = data.get("conversacion_id")
                contenido = data.get("contenido", "")
                db = SessionLocal()
                try:
                    conv = db.query(Conversacion).filter(Conversacion.id == conv_id).first()
                    if conv:
                        msg = Mensaje(
                            conversacion_id=conv_id,
                            remitente_id=user_id,
                            tipo=TipoMensaje.texto,
                            contenido=contenido,
                        )
                        db.add(msg)
                        db.commit()
                        db.refresh(msg)
                        destinatario = _get_destinatario(conv, user_id)
                        payload_out = {
                            "tipo": "mensaje",
                            "conversacion_id": conv_id,
                            "datos": {
                                "id": msg.id,
                                "tipo": "texto",
                                "contenido": contenido,
                                "remitente_id": user_id,
                                "creado_en": msg.creado_en.isoformat(),
                            }
                        }
                        await manager.send_to_user(destinatario, payload_out)
                        await manager.send_to_user(user_id, payload_out)
                        # Notificación
                        sender = db.query(Usuario).filter(Usuario.id == user_id).first()
                        notif = Notificacion(
                            usuario_id=destinatario,
                            tipo=TipoNotificacion.mensaje_nuevo,
                            titulo=f"Nuevo mensaje de {sender.nombre if sender else 'Usuario'}",
                            cuerpo=contenido[:100],
                            url_destino=f"/chat/{conv_id}",
                        )
                        db.add(notif)
                        db.commit()
                finally:
                    db.close()

            elif tipo == "leido":
                conv_id = data.get("conversacion_id")
                db = SessionLocal()
                try:
                    conv = db.query(Conversacion).filter(Conversacion.id == conv_id).first()
                    if conv:
                        for m in conv.mensajes:
                            if m.remitente_id != user_id:
                                m.leido = True
                        db.commit()
                        destinatario = _get_destinatario(conv, user_id)
                        await manager.send_to_user(destinatario, {"tipo": "leido", "conversacion_id": conv_id})
                finally:
                    db.close()

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
