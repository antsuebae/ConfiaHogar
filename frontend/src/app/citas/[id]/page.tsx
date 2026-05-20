"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { CalendarClock, CheckCircle, MessageCircle, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { Cita } from "@/types"
import { formatDate } from "@/lib/utils"
import toast from "react-hot-toast"

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "#F39C12",
  confirmada: "#2E86C1",
  en_curso: "#27AE60",
  completada: "#7D3C98",
  cancelada_cliente: "#E74C3C",
  cancelada_profesional: "#E74C3C",
}

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada_cliente: "Cancelada",
  cancelada_profesional: "Cancelada",
}

export default function DetalleCitaPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const citaId = params.id as string

  const [cita, setCita] = useState<Cita | null>(null)
  const [cargando, setCargando] = useState(true)
  const [motivoCancelacion, setMotivoCancelacion] = useState("")
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    api.get(`/citas/${citaId}`)
      .then(r => setCita(r.data))
      .catch(() => { toast.error("Cita no encontrada"); router.push("/calendario") })
      .finally(() => setCargando(false))
  }, [citaId, usuario])

  const cancelarCita = async () => {
    if (!cita || !motivoCancelacion.trim()) {
      toast.error("El motivo de cancelación es obligatorio")
      return
    }
    setCancelando(true)
    try {
      await api.post(`/citas/${cita.id}/cancelar`, { motivo: motivoCancelacion })
      toast.success("Cita cancelada")
      if (cita.cancelacion_tardia) {
        toast("Se aplicarán las políticas de cancelación tardía", { icon: "⚠️" })
      }
      router.push("/calendario")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al cancelar la cita")
    } finally {
      setCancelando(false)
    }
  }

  const aceptarPropuesta = async () => {
    if (!cita) return
    try {
      await api.post(`/citas/${cita.id}/aceptar-propuesta`)
      toast.success("Nueva fecha confirmada")
      api.get(`/citas/${citaId}`).then(r => setCita(r.data)).catch(() => {})
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al aceptar la propuesta")
    }
  }

  if (cargando) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
    </div>
  )

  if (!cita) return null

  const activa = !["cancelada_cliente", "cancelada_profesional", "completada"].includes(cita.estado)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{cita.titulo || "Detalle de cita"}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Badge style={{ backgroundColor: ESTADO_COLORS[cita.estado], color: "white" }}>
              {ESTADO_LABELS[cita.estado]}
            </Badge>
            {cita.cancelacion_tardia && (
              <Badge variant="destructive">Cancelación tardía</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2"><span className="text-gray-500 w-28">Fecha:</span><span>{formatDate(cita.fecha_inicio)}</span></div>
          {cita.nombre_profesional && <div className="flex gap-2"><span className="text-gray-500 w-28">Profesional:</span><span>{cita.nombre_profesional}</span></div>}
          {cita.ubicacion && <div className="flex gap-2"><span className="text-gray-500 w-28">Ubicación:</span><span>{cita.ubicacion}</span></div>}
          {cita.descripcion && <div className="flex gap-2"><span className="text-gray-500 w-28">Descripción:</span><span>{cita.descripcion}</span></div>}
        </CardContent>
      </Card>

      {cita.fecha_propuesta && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              El profesional propone otro horario
            </p>
            <p className="text-sm text-amber-700"><strong>{formatDate(cita.fecha_propuesta)}</strong></p>
            <p className="text-xs text-amber-600">Fecha original: {formatDate(cita.fecha_inicio)}</p>
            <Button
              size="sm"
              className="w-full gap-1 bg-amber-600 hover:bg-amber-700"
              onClick={aceptarPropuesta}
            >
              <CheckCircle className="h-3.5 w-3.5" /> Aceptar nuevo horario
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap">
        {cita.profesional_id && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push(`/chat?profesional=${cita.profesional_id}`)}
          >
            <MessageCircle className="h-4 w-4" /> Ver chat
          </Button>
        )}
        {cita.estado === "completada" && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push(`/citas/${cita.id}/resena`)}
          >
            <Star className="h-4 w-4" /> Dejar reseña
          </Button>
        )}
      </div>

      {activa && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-700">Cancelar cita</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
              placeholder="Motivo de cancelación (obligatorio)..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <Button
              variant="destructive"
              className="w-full"
              onClick={cancelarCita}
              disabled={cancelando || !motivoCancelacion.trim()}
            >
              {cancelando ? "Cancelando..." : "Confirmar cancelación"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
