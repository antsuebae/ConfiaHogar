"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Star, MessageSquare, Flag, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EstrellasPicker } from "@/components/resena/EstrellasPicker"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { Resena, ProfesionalDetalle } from "@/types"
import { getInitials, formatDate } from "@/lib/utils"
import toast from "react-hot-toast"

export default function ResenasProfesionalPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const [resenas, setResenas] = useState<Resena[]>([])
  const [prof, setProf] = useState<ProfesionalDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [respuesta, setRespuesta] = useState("")
  const [resenaActiva, setResenaActiva] = useState<Resena | null>(null)
  const [motivo, setMotivo] = useState("")
  const [reportando, setReportando] = useState<Resena | null>(null)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    api.get("/profesionales/me").then((r) => {
      setProf(r.data)
      return api.get(`/resenas/profesional/${r.data.id}`)
    }).then((r) => setResenas(r.data))
    .catch(() => {})
    .finally(() => setCargando(false))
  }, [usuario])

  const responderResena = async () => {
    if (!resenaActiva || !respuesta.trim()) return
    try {
      await api.post(`/resenas/${resenaActiva.id}/responder`, { respuesta })
      toast.success("Respuesta publicada")
      setResenas(prev => prev.map(r => r.id === resenaActiva.id ? { ...r, respuesta_profesional: respuesta } : r))
      setResenaActiva(null)
      setRespuesta("")
    } catch { toast.error("Error") }
  }

  const reportarResena = async () => {
    if (!reportando || !motivo.trim()) return
    try {
      await api.post(`/resenas/${reportando.id}/reportar`, { motivo })
      toast.success("Reseña reportada y ocultada pendiente de revisión")
      setResenas(prev => prev.filter(r => r.id !== reportando.id))
      setReportando(null)
    } catch { toast.error("Error") }
  }

  if (cargando) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis Reseñas</h1>
        {prof && (
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-accent-500 fill-accent-500" />
            <span className="font-bold text-gray-900">{prof.valoracion_media.toFixed(1)}</span>
            <span className="text-gray-500 text-sm">({prof.total_resenas} reseñas)</span>
          </div>
        )}
      </div>

      {resenas.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Star className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Aún no tienes reseñas</p>
        </div>
      )}

      <div className="space-y-4">
        {resenas.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={r.foto_cliente} />
                  <AvatarFallback className="text-sm">{getInitials(r.nombre_cliente || "?")}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-medium text-gray-900">{r.nombre_cliente}</span>
                    <span className="text-xs text-gray-400">{formatDate(r.creado_en)}</span>
                  </div>
                  <EstrellasPicker value={r.estrellas} onChange={() => {}} readonly size="sm" />
                  {r.comentario && <p className="mt-1 text-gray-700 text-sm">{r.comentario}</p>}
                  {r.imagen_url && (
                    <img src={r.imagen_url} alt="Imagen reseña" role="button" tabIndex={0}
                      className="mt-2 rounded-lg h-32 object-cover cursor-pointer"
                      onClick={() => window.open(r.imagen_url, "_blank")}
                      onKeyDown={(e) => e.key === "Enter" && window.open(r.imagen_url, "_blank")} />
                  )}
                  {r.respuesta_profesional && (
                    <div className="mt-3 pl-3 border-l-2 border-primary-300">
                      <p className="text-xs text-primary-600 font-medium mb-1">Tu respuesta</p>
                      <p className="text-sm text-gray-600">{r.respuesta_profesional}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    {!r.respuesta_profesional && (
                      <Button variant="outline" size="sm" onClick={() => setResenaActiva(r)} className="gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> Responder
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setReportando(r)} className="gap-1 text-gray-400 hover:text-danger">
                      <Flag className="h-3.5 w-3.5" /> Reportar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!resenaActiva} onOpenChange={() => setResenaActiva(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Responder reseña</DialogTitle></DialogHeader>
          <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Escribe tu respuesta pública..." />
          <div className="flex gap-3">
            <Button onClick={responderResena} className="flex-1">Publicar respuesta</Button>
            <Button variant="outline" onClick={() => setResenaActiva(null)} className="flex-1">Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportando} onOpenChange={() => setReportando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-danger">Reportar reseña</DialogTitle></DialogHeader>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del reporte (contenido inapropiado, spam...)" />
          <div className="flex gap-3">
            <Button variant="destructive" onClick={reportarResena} className="flex-1">Reportar</Button>
            <Button variant="outline" onClick={() => setReportando(null)} className="flex-1">Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
