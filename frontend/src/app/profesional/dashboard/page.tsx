"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Star, Calendar, MessageSquare, Euro, TrendingUp, CheckCircle, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { Cita, ProfesionalDetalle } from "@/types"
import { formatEuros, formatDate } from "@/lib/utils"
import Link from "next/link"

export default function DashboardProfesionalPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const [citas, setCitas] = useState<Cita[]>([])
  const [prof, setProf] = useState<ProfesionalDetalle | null>(null)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    if (usuario.rol !== "profesional") { router.push("/buscar"); return }
    Promise.all([
      api.get("/citas/mis-citas"),
      api.get("/profesionales/me").catch(() => null),
    ]).then(([c, p]) => {
      setCitas(c.data)
      if (p) setProf(p.data)
    })
  }, [usuario])

  const citasPendientes = citas.filter(c => ["pendiente", "confirmada"].includes(c.estado))
  const citasCompletadas = citas.filter(c => c.estado === "completada")

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel del Profesional</h1>
          <p className="text-gray-500">Bienvenido, {usuario?.nombre}</p>
        </div>
        {prof && !prof.verificado && (
          <Badge variant="warning" className="text-sm py-1 px-3">
            Perfil sin verificar
          </Badge>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Star, label: "Valoración", value: prof ? prof.valoracion_media.toFixed(1) + " ⭐" : "—", color: "text-accent-500" },
          { icon: CheckCircle, label: "Servicios", value: String(prof?.total_servicios || 0), color: "text-success" },
          { icon: Calendar, label: "Citas pend.", value: String(citasPendientes.length), color: "text-primary-600" },
          { icon: Euro, label: "Saldo pend.", value: formatEuros(prof?.saldo_pendiente || 0), color: "text-primary-600" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-bold text-gray-900">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Próximas citas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Próximas citas</CardTitle>
            <Link href="/profesional/calendario">
              <Button variant="ghost" size="sm">Ver todo</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {citasPendientes.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No hay citas pendientes</p>
            ) : (
              <div className="space-y-3">
                {citasPendientes.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <Clock className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.titulo || "Cita"}</p>
                      <p className="text-xs text-gray-500">{c.nombre_cliente} · {formatDate(c.fecha_inicio)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accesos rápidos */}
        <Card>
          <CardHeader><CardTitle className="text-base">Accesos rápidos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link href="/profesional/perfil">
              <Button variant="outline" className="w-full h-16 flex-col gap-1 text-xs">
                <TrendingUp className="h-5 w-5" /> Mi perfil
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="outline" className="w-full h-16 flex-col gap-1 text-xs">
                <MessageSquare className="h-5 w-5" /> Mensajes
              </Button>
            </Link>
            <Link href="/profesional/calendario">
              <Button variant="outline" className="w-full h-16 flex-col gap-1 text-xs">
                <Calendar className="h-5 w-5" /> Agenda
              </Button>
            </Link>
            <Link href="/profesional/resenas">
              <Button variant="outline" className="w-full h-16 flex-col gap-1 text-xs">
                <Star className="h-5 w-5" /> Reseñas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
