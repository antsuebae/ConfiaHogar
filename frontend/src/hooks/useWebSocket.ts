"use client"
import { useEffect, useRef, useCallback } from "react"
import { WS_URL } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useNotificacionesStore } from "@/store/notificaciones"

type WSHandler = (data: Record<string, unknown>) => void

export function useWebSocket(onMessage?: WSHandler) {
  const { token } = useAuthStore()
  const { addNotificacion } = useNotificacionesStore()
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef(onMessage)
  handlersRef.current = onMessage

  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(`${WS_URL}/mensajes/ws/${token}`)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        handlersRef.current?.(data)
        if (data.tipo === "notificacion") {
          addNotificacion(data.datos)
        }
      } catch {}
    }
    ws.onclose = () => {
      setTimeout(connect, 3000)
    }
    wsRef.current = ws
  }, [token, addNotificacion])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
