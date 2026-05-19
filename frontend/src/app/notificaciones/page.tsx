"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useNotificacionesStore } from "@/store/notificaciones"
import { formatDate } from "@/lib/utils"
import toast from "react-hot-toast"

export default function NotificacionesPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const { notificaciones, setNotificaciones, marcarLeida } = useNotificacionesStore()

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    api.get("/notificaciones/").then((r) => setNotificaciones(r.data)).catch(() => {})
  }, [usuario])

  const marcarTodas = async () => {
    try {
      await api.put("/notificaciones/leer-todas")
      notificaciones.forEach(n => marcarLeida(n.id))
      toast.success("Todas las notificaciones marcadas como leídas")
    } catch { toast.error("Error") }
  }

  const marcarUna = async (id: number, url?: string) => {
    await api.put(`/notificaciones/${id}/leer`).catch(() => {})
    marcarLeida(id)
    if (url) router.push(url)
  }

  const ICONOS: Record<string, string> = {
    mensaje_nuevo: "💬",
    cita_cancelada: "❌",
    presupuesto_recibido: "💰",
    pago_recibido: "✅",
    resena_recibida: "⭐",
    recordatorio_cita: "🔔",
    cuenta_verificada: "🛡️",
    discrepancia_pago: "⚠️",
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell className="h-6 w-6" /> Notificaciones
        </h1>
        {notificaciones.some(n => !n.leida) && (
          <Button variant="outline" size="sm" onClick={marcarTodas} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Marcar todas como leídas
          </Button>
        )}
      </div>

      {notificaciones.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No tienes notificaciones</p>
        </div>
      )}

      <div className="space-y-2">
        {notificaciones.map((n) => (
          <button
            key={n.id}
            onClick={() => marcarUna(n.id, n.url_destino)}
            className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-colors hover:bg-gray-50 ${!n.leida ? "bg-primary-50 border-primary-200" : "bg-white"}`}
          >
            <span className="text-2xl flex-shrink-0 mt-0.5">{ICONOS[n.tipo] || "🔔"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900 text-sm">{n.titulo}</p>
                {!n.leida && <Badge variant="default" className="flex-shrink-0 h-5 text-xs">Nuevo</Badge>}
              </div>
              {n.cuerpo && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{n.cuerpo}</p>}
              <p className="text-xs text-gray-400 mt-1">{formatDate(n.creado_en)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
