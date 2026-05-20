"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Star, CheckCircle, MapPin, Clock, Euro, MessageSquare, Calendar, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EstrellasPicker } from "@/components/resena/EstrellasPicker"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { ProfesionalDetalle, Resena } from "@/types"
import { getInitials, formatEuros, formatDate } from "@/lib/utils"
import toast from "react-hot-toast"

export default function PerfilProfesionalPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { usuario } = useAuthStore()
  const [prof, setProf] = useState<ProfesionalDetalle | null>(null)
  const [resenas, setResenas] = useState<Resena[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalCita, setModalCita] = useState(false)
  const [fechaCita, setFechaCita] = useState("")
  const [tituloCita, setTituloCita] = useState("")
  const [creandoCita, setCreandoCita] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get(`/profesionales/${id}`),
      api.get(`/resenas/profesional/${id}`),
    ]).then(([p, r]) => {
      setProf(p.data)
      setResenas(r.data)
    }).catch(() => toast.error("Error cargando el perfil"))
    .finally(() => setCargando(false))
  }, [id])

  const contactar = async () => {
    if (!usuario) { router.push("/login"); return }
    try {
      const res = await api.post("/mensajes/conversaciones", { profesional_id: Number(id) })
      router.push(`/chat/${res.data.id}`)
    } catch { toast.error("Error al iniciar conversación") }
  }

  const pedirCita = async () => {
    if (!fechaCita || !tituloCita.trim()) {
      toast.error("Rellena la fecha y el título del servicio")
      return
    }
    setCreandoCita(true)
    try {
      await api.post("/citas/", {
        profesional_id: prof?.id,
        titulo: tituloCita.trim(),
        fecha_inicio: new Date(fechaCita).toISOString(),
      })
      toast.success("¡Cita creada! Puedes verla en tu calendario")
      setModalCita(false)
      setFechaCita("")
      setTituloCita("")
      router.push("/calendario")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al crear la cita")
    } finally {
      setCreandoCita(false)
    }
  }

  if (cargando) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
  if (!prof) return <div className="text-center py-20 text-gray-500">Perfil no encontrado</div>

  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(prof.valoracion_media))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="relative flex-shrink-0">
              <Avatar className="h-24 w-24">
                <AvatarImage src={prof.foto_perfil_url} />
                <AvatarFallback className="text-2xl">{getInitials(prof.nombre || "")}</AvatarFallback>
              </Avatar>
              {prof.verificado && (
                <CheckCircle className="absolute -bottom-1 -right-1 h-7 w-7 text-success fill-white" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{prof.nombre}</h1>
                  <p className="text-primary-600 font-semibold">{prof.profesion}</p>
                </div>
                <div className="flex gap-2">
                  {prof.verificado && <Badge variant="default"><Shield className="h-3 w-3 mr-1" />Verificado</Badge>}
                  {prof.disponible ? <Badge variant="success">Disponible</Badge> : <Badge variant="secondary">No disponible</Badge>}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                {stars.map((filled, i) => (
                  <Star key={i} className={`h-5 w-5 ${filled ? "text-accent-500 fill-accent-500" : "text-gray-300"}`} />
                ))}
                {prof.valoracion_media > 0 ? (
                  <span className="text-gray-600">{prof.valoracion_media.toFixed(1)} ({prof.total_resenas} reseñas)</span>
                ) : (
                  <span className="text-gray-400 italic">Nuevo profesional — Aún sin valoraciones</span>
                )}
              </div>

              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                {prof.ciudad && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{prof.ciudad}</span>}
                {prof.tarifa_hora && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatEuros(prof.tarifa_hora)}/h</span>}
                {prof.tarifa_visita && <span className="flex items-center gap-1"><Euro className="h-4 w-4" />Visita: {formatEuros(prof.tarifa_visita)}</span>}
              </div>

              {prof.descripcion_profesional && (
                <p className="mt-3 text-gray-700 leading-relaxed">{prof.descripcion_profesional}</p>
              )}

              <div className="flex gap-3 mt-4">
                <Button onClick={contactar} className="gap-2">
                  <MessageSquare className="h-4 w-4" /> Contactar
                </Button>
                {usuario && usuario.rol === "cliente" && (
                  <Button variant="outline" className="gap-2" onClick={() => setModalCita(true)}>
                    <Calendar className="h-4 w-4" /> Pedir cita
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificaciones */}
      {prof.certificaciones?.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Certificaciones</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {prof.certificaciones.filter(c => c.estado === "aprobada").map((cert) => (
                <div key={cert.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                  <span className="font-medium text-gray-800">{cert.nombre}</span>
                  <Badge variant="success" className="ml-auto">Verificada</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reseñas */}
      <Card>
        <CardHeader>
          <CardTitle>Reseñas ({resenas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {resenas.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Star className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Nuevo profesional — Aún sin valoraciones</p>
            </div>
          )}
          <div className="space-y-4">
            {resenas.map((r) => (
              <div key={r.id} className="border-b last:border-0 pb-4 last:pb-0">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={r.foto_cliente} />
                    <AvatarFallback className="text-xs">{getInitials(r.nombre_cliente || "?")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-medium text-gray-900">{r.nombre_cliente}</span>
                      <span className="text-xs text-gray-400">{formatDate(r.creado_en)}</span>
                    </div>
                    <EstrellasPicker value={r.estrellas} onChange={() => {}} readonly size="sm" />
                    {r.comentario && <p className="mt-1 text-gray-700 text-sm">{r.comentario}</p>}
                    {r.imagen_url && (
                      <img
                        src={r.imagen_url}
                        alt="Foto del trabajo"
                        role="button"
                        tabIndex={0}
                        className="mt-2 rounded-lg h-32 object-cover cursor-pointer"
                        onClick={() => window.open(r.imagen_url, "_blank")}
                        onKeyDown={(e) => e.key === "Enter" && window.open(r.imagen_url, "_blank")}
                      />
                    )}
                    {r.respuesta_profesional && (
                      <div className="mt-2 pl-3 border-l-2 border-primary-300">
                        <p className="text-xs text-primary-600 font-medium mb-1">Respuesta del profesional</p>
                        <p className="text-sm text-gray-600">{r.respuesta_profesional}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal pedir cita */}
      <Dialog open={modalCita} onOpenChange={setModalCita}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary-600" />
              Pedir cita con {prof?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="titulo-cita">Descripción del servicio *</Label>
              <Input
                id="titulo-cita"
                value={tituloCita}
                onChange={(e) => setTituloCita(e.target.value)}
                placeholder="ej: Reparación fuga tubería"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="fecha-cita">Fecha y hora *</Label>
              <Input
                id="fecha-cita"
                type="datetime-local"
                value={fechaCita}
                onChange={(e) => setFechaCita(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={pedirCita} disabled={creandoCita || !fechaCita || !tituloCita.trim()} className="flex-1">
                {creandoCita ? "Creando..." : "Confirmar cita"}
              </Button>
              <Button variant="outline" onClick={() => setModalCita(false)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
