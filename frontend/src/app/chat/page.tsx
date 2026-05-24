"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MessageSquare, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { Conversacion } from "@/types"
import { getInitials } from "@/lib/utils"
import toast from "react-hot-toast"

export default function ChatPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const params = useSearchParams()
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [activa, setActiva] = useState<Conversacion | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    cargarConversaciones()
  }, [usuario])

  useEffect(() => {
    // Abrir conversación específica si viene por ?activa=ID
    const activaId = params.get("activa")
    if (activaId && conversaciones.length > 0) {
      const found = conversaciones.find(c => c.id === Number(activaId))
      if (found) setActiva(found)
    }
  }, [params, conversaciones])

  const cargarConversaciones = async () => {
    try {
      const res = await api.get("/mensajes/conversaciones")
      setConversaciones(res.data)
      if (!activa && res.data.length > 0) setActiva(res.data[0])
    } catch { toast.error("Error cargando mensajes") }
    finally { setCargando(false) }
  }

  const getNombreOtro = (c: Conversacion) =>
    usuario?.id === c.cliente_id ? c.nombre_profesional : c.nombre_cliente
  const getFotoOtro = (c: Conversacion) =>
    usuario?.id === c.cliente_id ? c.foto_profesional : c.foto_cliente

  if (cargando) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4">
      <div className="flex gap-4 h-[calc(100vh-5rem)]">
        {/* Lista de conversaciones */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Mensajes</h2>
          </div>
          {conversaciones.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aún no tienes conversaciones</p>
            </div>
          ) : (
            conversaciones.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiva(c)}
                aria-current={activa?.id === c.id ? "page" : undefined}
                className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors border-b last:border-0 ${activa?.id === c.id ? "bg-primary-50" : ""}`}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={getFotoOtro(c)} />
                  <AvatarFallback className="text-xs">{getInitials(getNombreOtro(c) || "?")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate">{getNombreOtro(c)}</span>
                    {c.no_leidos > 0 && (
                      <Badge variant="default" className="h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full">
                        {c.no_leidos}
                      </Badge>
                    )}
                  </div>
                  {c.ultimo_mensaje && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{c.ultimo_mensaje}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Ventana de chat */}
        <div className="flex-1 bg-white rounded-xl border overflow-hidden">
          {activa ? (
            <ChatWindow conversacion={activa} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Selecciona una conversación</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
