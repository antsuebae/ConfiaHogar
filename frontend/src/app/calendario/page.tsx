"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Calendar as CalIcon, Plus, Search, Bell, CalendarClock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useWebSocket } from "@/hooks/useWebSocket"
import type { Cita } from "@/types"
import { formatDate } from "@/lib/utils"
import toast from "react-hot-toast"

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false })

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

export default function CalendarioPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const [citas, setCitas] = useState<Cita[]>([])
  const [citaSeleccionada, setCitaSeleccionada] = useState<Cita | null>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState("")
  const [cancelando, setCancelando] = useState(false)
  const [dayGridPlugin, setDayGridPlugin] = useState<unknown>(null)
  const [timeGridPlugin, setTimeGridPlugin] = useState<unknown>(null)
  const [interactionPlugin, setInteractionPlugin] = useState<unknown>(null)

  useWebSocket((data) => {
    if (data.tipo === "cita_actualizada") cargarCitas()
  })

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    cargarCitas()
    Promise.all([
      import("@fullcalendar/daygrid"),
      import("@fullcalendar/timegrid"),
      import("@fullcalendar/interaction"),
    ]).then(([dg, tg, ip]) => {
      setDayGridPlugin(dg.default)
      setTimeGridPlugin(tg.default)
      setInteractionPlugin(ip.default)
    })
  }, [usuario])

  const cargarCitas = async () => {
    try {
      const res = await api.get("/citas/mis-citas")
      setCitas(res.data)
    } catch { toast.error("Error cargando el calendario") }
  }

  const cancelarCita = async () => {
    if (!citaSeleccionada || !motivoCancelacion.trim()) {
      toast.error("El motivo de cancelación es obligatorio")
      return
    }
    setCancelando(true)
    try {
      await api.post(`/citas/${citaSeleccionada.id}/cancelar`, { motivo: motivoCancelacion })
      toast.success("Cita cancelada")
      if (citaSeleccionada.cancelacion_tardia) {
        toast("Se aplicarán las políticas de cancelación tardía", { icon: "⚠️" })
      }
      setCitaSeleccionada(null)
      cargarCitas()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al cancelar la cita")
    } finally {
      setCancelando(false)
    }
  }

  const aceptarPropuesta = async (cita: Cita) => {
    try {
      await api.post(`/citas/${cita.id}/aceptar-propuesta`)
      toast.success("Nueva fecha confirmada")
      setCitaSeleccionada(null)
      cargarCitas()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al aceptar la propuesta")
    }
  }

  const configurarRecordatorio = async (cita: Cita, minutos: number) => {
    try {
      await api.post(`/citas/${cita.id}/recordatorio`, { minutos_antes: minutos })
      toast.success(`Recordatorio configurado para ${minutos} minutos antes`)
      cargarCitas()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al configurar el recordatorio")
    }
  }

  const eventos = citas.map((c) => ({
    id: String(c.id),
    title: c.titulo || "Cita",
    start: c.fecha_inicio,
    end: c.fecha_fin || c.fecha_inicio,
    backgroundColor: ESTADO_COLORS[c.estado] || "#999",
    extendedProps: { cita: c },
  }))

  if (!dayGridPlugin) return (
    <div className="flex justify-center py-20">
      <div className="text-center text-gray-400">
        <CalIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Cargando calendario...</p>
      </div>
    </div>
  )

  if (citas.length === 0) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <CalIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Tu calendario está vacío</h2>
      <p className="text-gray-500 mb-6">Busca un profesional y agenda tu primera cita</p>
      <Button onClick={() => router.push("/buscar")} className="gap-2">
        <Search className="h-4 w-4" /> Buscar un profesional
      </Button>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Calendario</h1>
        <Button onClick={() => router.push("/buscar")} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nueva cita
        </Button>
      </div>

      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin as never, timeGridPlugin as never, interactionPlugin as never]}
          initialView="dayGridMonth"
          locale="es"
          events={eventos}
          eventClick={(info) => setCitaSeleccionada(info.event.extendedProps.cita)}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana" }}
          height="auto"
          eventDisplay="block"
        />
      </div>

      {/* Modal detalle de cita */}
      <Dialog open={!!citaSeleccionada} onOpenChange={() => setCitaSeleccionada(null)}>
        <DialogContent className="sm:max-w-md">
          {citaSeleccionada && (
            <>
              <DialogHeader>
                <DialogTitle>{citaSeleccionada.titulo || "Detalle de cita"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge style={{ backgroundColor: ESTADO_COLORS[citaSeleccionada.estado], color: "white" }}>
                    {ESTADO_LABELS[citaSeleccionada.estado]}
                  </Badge>
                  {citaSeleccionada.cancelacion_tardia && (
                    <Badge variant="destructive">Cancelación tardía</Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex gap-2"><span className="text-gray-500 w-28">Fecha:</span><span>{formatDate(citaSeleccionada.fecha_inicio)}</span></div>
                  {citaSeleccionada.nombre_profesional && <div className="flex gap-2"><span className="text-gray-500 w-28">Profesional:</span><span>{citaSeleccionada.nombre_profesional}</span></div>}
                  {citaSeleccionada.ubicacion && <div className="flex gap-2"><span className="text-gray-500 w-28">Ubicación:</span><span>{citaSeleccionada.ubicacion}</span></div>}
                  {citaSeleccionada.descripcion && <div className="flex gap-2"><span className="text-gray-500 w-28">Descripción:</span><span>{citaSeleccionada.descripcion}</span></div>}
                </div>

                {/* Propuesta de nueva fecha del profesional */}
                {citaSeleccionada.fecha_propuesta && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-1">
                      <CalendarClock className="h-4 w-4" />
                      El profesional propone otro horario
                    </p>
                    <p className="text-sm text-amber-700">
                      <strong>{formatDate(citaSeleccionada.fecha_propuesta)}</strong>
                    </p>
                    <p className="text-xs text-amber-600">Fecha original: {formatDate(citaSeleccionada.fecha_inicio)}</p>
                    <Button
                      size="sm"
                      className="w-full gap-1 bg-amber-600 hover:bg-amber-700"
                      onClick={() => aceptarPropuesta(citaSeleccionada)}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Aceptar nuevo horario
                    </Button>
                  </div>
                )}

                {!["cancelada_cliente", "cancelada_profesional", "completada"].includes(citaSeleccionada.estado) && (
                  <div className="space-y-3 pt-2 border-t">
                    {/* Recordatorio */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        <Bell className="inline h-4 w-4 mr-1" />
                        Recordatorio
                        {citaSeleccionada.recordatorio_minutos && (
                          <span className="ml-2 text-primary-600">({citaSeleccionada.recordatorio_minutos} min antes)</span>
                        )}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {[30, 60, 120, 1440].map((min) => (
                          <Button key={min} variant="outline" size="sm" onClick={() => configurarRecordatorio(citaSeleccionada, min)}>
                            {min < 60 ? `${min} min` : min === 1440 ? "1 día" : `${min / 60}h`}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Cancelar */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Cancelar cita</p>
                      <textarea
                        value={motivoCancelacion}
                        onChange={(e) => setMotivoCancelacion(e.target.value)}
                        placeholder="Motivo de cancelación..."
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none h-20"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={cancelarCita}
                        disabled={cancelando || !motivoCancelacion.trim()}
                      >
                        {cancelando ? "Cancelando..." : "Confirmar cancelación"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
