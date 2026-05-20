"use client"
import { useEffect, useRef, useCallback } from "react"
import { WS_URL } from "@/lib/config"
import { useAuthStore } from "@/store/auth"
import { useNotificacionesStore } from "@/store/notificaciones"

type WSHandler = (data: Record<string, unknown>) => void

export function useWebSocket(onMessage?: WSHandler) {
  const { token } = useAuthStore()
  const { addNotificacion } = useNotificacionesStore()
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<WSHandler | undefined>(undefined)
  const isMountedRef = useRef(true)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    handlersRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (!isMountedRef.current) return
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
      if (isMountedRef.current) {
        reconnectTimerRef.current = setTimeout(connect, 3000)
      }
    }
    ws.onerror = () => {
      ws.close()
    }
    wsRef.current = ws
  }, [token, addNotificacion])

  useEffect(() => {
    isMountedRef.current = true
    connect()
    return () => {
      isMountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
