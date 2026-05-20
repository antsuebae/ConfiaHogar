"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, CheckCircle, XCircle, FileText, Loader2, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import toast from "react-hot-toast"

interface VerifPendiente {
  profesional_id: number
  usuario_id: number
  nombre: string
  email: string
  profesion: string
  ciudad?: string
}

interface CertPendiente {
  id: number
  profesional_id: number
  nombre_profesional: string
  nombre: string
  documento_url?: string
  creado_en: string
}

export default function AdminPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<"verificaciones" | "certificaciones">("verificaciones")
  const [verificaciones, setVerificaciones] = useState<VerifPendiente[]>([])
  const [certificaciones, setCertificaciones] = useState<CertPendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState<number | null>(null)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    if (usuario.email !== "admin@confiahogar.com") { router.push("/"); return }
    cargar()
  }, [usuario, router])

  const cargar = async () => {
    setCargando(true)
    try {
      const [v, c] = await Promise.all([
        api.get("/admin/verificaciones"),
        api.get("/admin/certificaciones"),
      ])
      setVerificaciones(v.data)
      setCertificaciones(c.data)
    } catch {
      toast.error("Error cargando panel de administración")
    } finally {
      setCargando(false)
    }
  }

  const aprobarVerif = async (id: number) => {
    setProcesando(id)
    try {
      await api.post(`/admin/verificaciones/${id}/aprobar`)
      toast.success("Verificación aprobada")
      setVerificaciones(prev => prev.filter(v => v.profesional_id !== id))
    } catch { toast.error("Error") } finally { setProcesando(null) }
  }

  const rechazarVerif = async (id: number) => {
    setProcesando(id)
    try {
      await api.post(`/admin/verificaciones/${id}/rechazar`, null, { params: { motivo: "Documentación insuficiente o no válida" } })
      toast.success("Verificación rechazada")
      setVerificaciones(prev => prev.filter(v => v.profesional_id !== id))
    } catch { toast.error("Error") } finally { setProcesando(null) }
  }

  const aprobarCert = async (id: number) => {
    setProcesando(id)
    try {
      await api.post(`/admin/certificaciones/${id}/aprobar`)
      toast.success("Certificación aprobada")
      setCertificaciones(prev => prev.filter(c => c.id !== id))
    } catch { toast.error("Error") } finally { setProcesando(null) }
  }

  const rechazarCert = async (id: number) => {
    setProcesando(id)
    try {
      await api.post(`/admin/certificaciones/${id}/rechazar`, null, { params: { motivo: "Documento no válido o ilegible" } })
      toast.success("Certificación rechazada")
      setCertificaciones(prev => prev.filter(c => c.id !== id))
    } catch { toast.error("Error") } finally { setProcesando(null) }
  }

  if (cargando) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-7 w-7 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <Badge variant="default">admin@confiahogar.com</Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "verificaciones" ? "default" : "outline"}
          onClick={() => setTab("verificaciones")}
          className="gap-2"
        >
          <Shield className="h-4 w-4" />
          Verificaciones
          {verificaciones.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{verificaciones.length}</span>
          )}
        </Button>
        <Button
          variant={tab === "certificaciones" ? "default" : "outline"}
          onClick={() => setTab("certificaciones")}
          className="gap-2"
        >
          <Award className="h-4 w-4" />
          Certificaciones
          {certificaciones.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{certificaciones.length}</span>
          )}
        </Button>
      </div>

      {tab === "verificaciones" && (
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes de verificación pendientes ({verificaciones.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {verificaciones.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>No hay solicitudes pendientes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {verificaciones.map((v) => (
                  <div key={v.profesional_id} className="flex items-center justify-between gap-4 p-4 border rounded-lg">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{v.nombre}</p>
                      <p className="text-sm text-gray-500 truncate">{v.email} · {v.profesion}{v.ciudad ? ` · ${v.ciudad}` : ""}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => aprobarVerif(v.profesional_id)}
                        disabled={procesando === v.profesional_id}
                        className="gap-1"
                      >
                        {procesando === v.profesional_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rechazarVerif(v.profesional_id)}
                        disabled={procesando === v.profesional_id}
                        className="gap-1"
                      >
                        <XCircle className="h-3 w-3" /> Rechazar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "certificaciones" && (
        <Card>
          <CardHeader>
            <CardTitle>Certificaciones pendientes de revisión ({certificaciones.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {certificaciones.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Award className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>No hay certificaciones pendientes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {certificaciones.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4 border rounded-lg">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{c.nombre}</p>
                      <p className="text-sm text-gray-500 truncate">{c.nombre_profesional}</p>
                      {c.documento_url && (
                        <button
                          className="text-xs text-primary-600 underline flex items-center gap-1 mt-1"
                          onClick={() => window.open(c.documento_url, "_blank")}
                        >
                          <FileText className="h-3 w-3" /> Ver documento
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => aprobarCert(c.id)}
                        disabled={procesando === c.id}
                        className="gap-1"
                      >
                        {procesando === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rechazarCert(c.id)}
                        disabled={procesando === c.id}
                        className="gap-1"
                      >
                        <XCircle className="h-3 w-3" /> Rechazar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
