"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Calendar as CalIcon, AlertTriangle, Clock, Plus, Trash2, CheckCircle, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useWebSocket } from "@/hooks/useWebSocket"
import type { Cita, FranjaDisponible } from "@/types"
import type { PluginDef } from "@fullcalendar/core"
import { formatDate } from "@/lib/utils"
import toast from "react-hot-toast"

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false })

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const COLORES: Record<string, string> = {
  pendiente: "#F39C12",
  confirmada: "#2E86C1",
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

interface FranjaLocal {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export default function CalendarioProfesionalPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const [citas, setCitas] = useState<Cita[]>([])
  const [activa, setActiva] = useState<Cita | null>(null)
  const [motivo, setMotivo] = useState("")
  const [plugins, setPlugins] = useState<PluginDef[]>([])
  const [franjas, setFranjas] = useState<FranjaLocal[]>([])
  const [guardando, setGuardando] = useState(false)
  const [modalPropuesta, setModalPropuesta] = useState<Cita | null>(null)
  const [fechaPropuesta, setFechaPropuesta] = useState("")

  useWebSocket((data) => {
    if (data.tipo === "cita_actualizada") cargar()
  })

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    cargar()
    cargarFranjas()
    Promise.all([
      import("@fullcalendar/daygrid"),
      import("@fullcalendar/timegrid"),
      import("@fullcalendar/interaction"),
    ]).then(([dg, tg, ip]) => setPlugins([dg.default, tg.default, ip.default]))
  }, [usuario])

  const cargar = () =>
    api.get("/citas/mis-citas").then(r => setCitas(r.data)).catch(() => toast.error("Error cargando agenda"))

  const cargarFranjas = () =>
    api.get("/disponibilidad/profesionales/me/franjas")
      .then(r => setFranjas(r.data))
      .catch(() => {})

  const cancelar = async () => {
    if (!activa || !motivo.trim()) { toast.error("El motivo es obligatorio"); return }
    try {
      await api.post(`/citas/${activa.id}/cancelar`, { motivo })
      toast.success("Cita cancelada y cliente notificado")
      setActiva(null)
      cargar()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al cancelar")
    }
  }

  const confirmarCita = async (cita: Cita) => {
    try {
      await api.post(`/citas/${cita.id}/confirmar`)
      toast.success("Cita confirmada — el cliente ha sido notificado")
      cargar()
      setActiva(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al confirmar")
    }
  }

  const proponerFecha = async () => {
    if (!modalPropuesta || !fechaPropuesta) return
    try {
      await api.post(`/citas/${modalPropuesta.id}/proponer-fecha`, {
        fecha_propuesta: new Date(fechaPropuesta).toISOString(),
      })
      toast.success("Propuesta enviada al cliente")
      setModalPropuesta(null)
      setFechaPropuesta("")
      cargar()
      setActiva(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al proponer fecha")
    }
  }

  const guardarFranjas = async () => {
    for (const f of franjas) {
      if (f.hora_fin <= f.hora_inicio) {
        toast.error(`La hora de fin debe ser posterior a la de inicio (día ${DIAS[f.dia_semana]})`)
        return
      }
    }
    setGuardando(true)
    try {
      await api.put("/disponibilidad/profesionales/me/franjas", franjas)
      toast.success("Disponibilidad guardada")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error guardando disponibilidad")
    } finally {
      setGuardando(false)
    }
  }

  const addFranja = (dia: number) => {
    setFranjas(prev => [...prev, { dia_semana: dia, hora_inicio: "09:00", hora_fin: "18:00" }])
  }

  const removeFranja = (idx: number) => {
    setFranjas(prev => prev.filter((_, i) => i !== idx))
  }

  const updateFranja = (idx: number, field: "hora_inicio" | "hora_fin", val: string) => {
    setFranjas(prev => prev.map((f, i) => i === idx ? { ...f, [field]: val } : f))
  }

  const citasPendientes = citas.filter(c => c.estado === "pendiente")

  const superpuestasIds = new Set<number>()
  const sorted = [...citas].sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
  for (let i = 0; i < sorted.length - 1; i++) {
    const finI = new Date(sorted[i].fecha_fin || sorted[i].fecha_inicio).getTime() + 3600000
    if (new Date(sorted[i + 1].fecha_inicio).getTime() < finI) {
      superpuestasIds.add(sorted[i].id)
      superpuestasIds.add(sorted[i + 1].id)
    }
  }
  const superpuestas = citas.filter(c => superpuestasIds.has(c.id))

  const eventos = citas.map(c => ({
    id: String(c.id),
    title: `${c.nombre_cliente || "Cliente"} - ${c.titulo || "Cita"}`,
    start: c.fecha_inicio,
    end: c.fecha_fin || c.fecha_inicio,
    backgroundColor: superpuestas.find(s => s.id === c.id) ? "#E74C3C" : (COLORES[c.estado] || "#999"),
    extendedProps: { cita: c },
  }))

  // Render available slots as background events
  const eventosDisponibilidad = DIAS.flatMap((_, dia) => {
    const franjasDia = franjas.filter(f => f.dia_semana === dia)
    return franjasDia.map((f, i) => ({
      id: `disp-${dia}-${i}`,
      title: "",
      daysOfWeek: [dia === 6 ? 0 : dia + 1], // FullCalendar: 0=Sun
      startTime: f.hora_inicio,
      endTime: f.hora_fin,
      display: "background",
      backgroundColor: "#d1fae5",
    }))
  })

  if (!plugins.length) return (
    <div className="flex justify-center py-20">
      <CalIcon className="h-10 w-10 text-gray-300 animate-pulse" />
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mi Agenda</h1>
        {superpuestas.length > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {superpuestas.length} citas superpuestas
          </Badge>
        )}
      </div>

      {/* Solicitudes pendientes de confirmar */}
      {citasPendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Solicitudes pendientes de confirmar ({citasPendientes.length})
          </h2>
          <div className="space-y-2">
            {citasPendientes.map(cita => (
              <div key={cita.id} className="bg-white rounded-lg border border-amber-200 p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{cita.titulo || "Servicio"}</p>
                  <p className="text-xs text-gray-500">
                    {cita.nombre_cliente} · {formatDate(cita.fecha_inicio)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 gap-1"
                    onClick={() => confirmarCita(cita)}>
                    <CheckCircle className="h-3 w-3" /> Confirmar
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => { setModalPropuesta(cita); setFechaPropuesta("") }}>
                    <Clock className="h-3 w-3" /> Proponer otra hora
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendario */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <FullCalendar
          plugins={plugins}
          initialView="timeGridWeek"
          locale="es"
          events={[...eventos, ...eventosDisponibilidad]}
          eventClick={(i) => { if (!i.event.id.startsWith("disp-")) setActiva(i.event.extendedProps.cita) }}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día" }}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
        />
      </div>

      {/* Gestión de disponibilidad semanal */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-1">Disponibilidad semanal</h2>
        <p className="text-sm text-gray-500 mb-4">Define los días y horarios en que los clientes pueden solicitar citas. Los slots aparecen en verde en el calendario.</p>

        <div className="space-y-3">
          {DIAS.map((dia, idx) => {
            const franjasDia = franjas.map((f, i) => ({ ...f, idx: i })).filter(f => f.dia_semana === idx)
            return (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-24 flex-shrink-0 pt-2">
                  <span className="text-sm font-medium text-gray-700">{dia}</span>
                </div>
                <div className="flex-1 space-y-2">
                  {franjasDia.length === 0 && (
                    <span className="text-sm text-gray-400 italic">Sin disponibilidad</span>
                  )}
                  {franjasDia.map(f => (
                    <div key={f.idx} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="time"
                        value={f.hora_inicio}
                        onChange={e => updateFranja(f.idx, "hora_inicio", e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-gray-400 text-sm">—</span>
                      <input
                        type="time"
                        value={f.hora_fin}
                        onChange={e => updateFranja(f.idx, "hora_fin", e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button onClick={() => removeFranja(f.idx)} aria-label="Eliminar franja" className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addFranja(idx)}
                  aria-label={`Añadir franja en ${dia}`}
                  className="flex-shrink-0 mt-1 text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>

        <Button className="mt-5" onClick={guardarFranjas} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar disponibilidad"}
        </Button>
      </div>

      {/* Modal detalle cita */}
      <Dialog open={!!activa} onOpenChange={() => { setActiva(null); setMotivo("") }}>
        <DialogContent>
          {activa && (
            <>
              <DialogHeader>
                <DialogTitle>{activa.titulo || "Detalle de cita"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2"><span className="text-gray-500 w-24">Cliente:</span><span>{activa.nombre_cliente}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-24">Fecha:</span><span>{formatDate(activa.fecha_inicio)}</span></div>
                {activa.ubicacion && <div className="flex gap-2"><span className="text-gray-500 w-24">Ubicación:</span><span>{activa.ubicacion}</span></div>}
                <div className="flex gap-2"><span className="text-gray-500 w-24">Estado:</span>
                  <Badge style={{ backgroundColor: COLORES[activa.estado] || "#999", color: "white" }}>{ESTADO_LABELS[activa.estado] || activa.estado}</Badge>
                </div>
              </div>

              {activa.estado === "pendiente" && (
                <div className="pt-3 border-t flex gap-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700 gap-1" onClick={() => confirmarCita(activa)}>
                    <CheckCircle className="h-4 w-4" /> Confirmar horario
                  </Button>
                  <Button variant="outline" className="flex-1 gap-1"
                    onClick={() => { setModalPropuesta(activa); setFechaPropuesta("") }}>
                    <Clock className="h-4 w-4" /> Proponer otra hora
                  </Button>
                </div>
              )}

              {!["completada", "cancelada_cliente", "cancelada_profesional", "pendiente"].includes(activa.estado) && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-sm font-medium">Cancelar cita</p>
                  <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
                    className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Motivo obligatorio (se enviará al cliente)..." />
                  <Button variant="destructive" className="w-full" onClick={cancelar} disabled={!motivo.trim()}>
                    Confirmar cancelación
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal proponer nueva fecha */}
      <Dialog open={!!modalPropuesta} onOpenChange={() => { setModalPropuesta(null); setFechaPropuesta("") }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600" />
              Proponer otro horario
            </DialogTitle>
          </DialogHeader>
          {modalPropuesta && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-600">
                La cita fue solicitada para: <strong>{formatDate(modalPropuesta.fecha_inicio)}</strong>.
                Propón un horario alternativo y el cliente podrá aceptarlo.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Nuevo horario propuesto</label>
                <input
                  type="datetime-local"
                  min={new Date().toISOString().slice(0, 16)}
                  value={fechaPropuesta}
                  onChange={e => setFechaPropuesta(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <Button className="w-full" onClick={proponerFecha} disabled={!fechaPropuesta}>
                Enviar propuesta al cliente
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setModalPropuesta(null)}>Cancelar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
