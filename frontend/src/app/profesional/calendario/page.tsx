"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Calendar as CalIcon, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { Cita } from "@/types"
import { formatDate } from "@/lib/utils"
import toast from "react-hot-toast"

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false })

const COLORES: Record<string, string> = {
  pendiente: "#F39C12",
  confirmada: "#2E86C1",
  completada: "#7D3C98",
  cancelada_cliente: "#E74C3C",
  cancelada_profesional: "#E74C3C",
}

export default function CalendarioProfesionalPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const [citas, setCitas] = useState<Cita[]>([])
  const [activa, setActiva] = useState<Cita | null>(null)
  const [motivo, setMotivo] = useState("")
  const [plugins, setPlugins] = useState<unknown[]>([])

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    cargar()
    Promise.all([
      import("@fullcalendar/daygrid"),
      import("@fullcalendar/timegrid"),
      import("@fullcalendar/interaction"),
    ]).then(([dg, tg, ip]) => setPlugins([dg.default, tg.default, ip.default]))
  }, [usuario])

  const cargar = () => api.get("/citas/mis-citas").then(r => setCitas(r.data)).catch(() => toast.error("Error cargando agenda"))

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

  const superpuestas = citas.filter(c1 =>
    citas.some(c2 => c1.id !== c2.id &&
      new Date(c1.fecha_inicio) < new Date(c2.fecha_fin || c2.fecha_inicio) &&
      new Date(c1.fecha_fin || c1.fecha_inicio) > new Date(c2.fecha_inicio))
  )

  const eventos = citas.map(c => ({
    id: String(c.id),
    title: `${c.nombre_cliente || "Cliente"} - ${c.titulo || "Cita"}`,
    start: c.fecha_inicio,
    end: c.fecha_fin || c.fecha_inicio,
    backgroundColor: superpuestas.find(s => s.id === c.id) ? "#E74C3C" : (COLORES[c.estado] || "#999"),
    extendedProps: { cita: c },
  }))

  if (!plugins.length) return <div className="flex justify-center py-20"><CalIcon className="h-10 w-10 text-gray-300 animate-pulse" /></div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Agenda</h1>
        {superpuestas.length > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {superpuestas.length} citas superpuestas
          </Badge>
        )}
      </div>

      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <FullCalendar
          plugins={plugins as never[]}
          initialView="timeGridWeek"
          locale="es"
          events={eventos}
          eventClick={(i) => setActiva(i.event.extendedProps.cita)}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día" }}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
        />
      </div>

      <Dialog open={!!activa} onOpenChange={() => setActiva(null)}>
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
                  <Badge style={{ backgroundColor: COLORES[activa.estado] || "#999", color: "white" }}>{activa.estado}</Badge>
                </div>
              </div>

              {!["completada", "cancelada_cliente", "cancelada_profesional"].includes(activa.estado) && (
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
    </div>
  )
}
