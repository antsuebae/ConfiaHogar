"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Euro, Download, AlertCircle, CheckCircle, Clock, Loader2, ArrowDownToLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { API_URL } from "@/lib/config"
import { useAuthStore } from "@/store/auth"
import type { Transaccion, ProfesionalDetalle } from "@/types"
import { formatEuros, formatDate } from "@/lib/utils"
import toast from "react-hot-toast"

const ESTADO_BADGE: Record<string, { label: string; variant: "default" | "success" | "warning" | "secondary" | "destructive" }> = {
  completada: { label: "Completada", variant: "success" },
  congelada: { label: "En revisión", variant: "warning" },
  pendiente: { label: "Pendiente", variant: "secondary" },
  pendiente_validacion: { label: "Pend. validación", variant: "warning" },
  discrepancia: { label: "Discrepancia", variant: "destructive" },
}

export default function CobrosPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const [prof, setProf] = useState<ProfesionalDetalle | null>(null)
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [retirando, setRetirando] = useState(false)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    if (usuario.rol !== "profesional") { router.push("/buscar"); return }
    Promise.all([
      api.get("/profesionales/me"),
      api.get("/citas/mis-citas"),
    ]).then(async ([p]) => {
      setProf(p.data)
      // Load transactions via cobros endpoint (falls back to empty if not yet implemented)
      try {
        const txRes = await api.get("/pagos/mis-cobros")
        setTransacciones(txRes.data)
      } catch {
        setTransacciones([])
      }
    }).catch(() => toast.error("Error cargando cobros"))
    .finally(() => setCargando(false))
  }, [usuario, router])

  const retirar = async () => {
    setRetirando(true)
    try {
      const res = await api.post("/profesionales/me/retirar")
      toast.success(`${formatEuros(res.data.importe)} transferidos a tu cuenta (${res.data.iban_destino})`)
      setProf(prev => prev ? { ...prev, saldo_pendiente: 0 } : prev)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al retirar fondos")
    } finally {
      setRetirando(false)
    }
  }

  const descargarFactura = (tx: Transaccion) => {
    const tipo = tx.metodo === "efectivo" ? "efectivo" : "cobro"
    window.open(`${API_URL}/facturas/${tipo}/${tx.id}.pdf`, "_blank")
  }

  if (cargando) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis cobros</h1>

      {/* Saldo disponible */}
      <Card className="mb-6 border-primary-200 bg-primary-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-primary-700 mb-1">Saldo disponible para retirar</p>
              <p className="text-4xl font-bold text-primary-900">{formatEuros(prof?.saldo_pendiente || 0)}</p>
              {(prof?.saldo_pendiente || 0) <= 0 && (
                <p className="text-xs text-primary-500 mt-1">Los pagos congelados se liberan en 24h</p>
              )}
            </div>
            <Button
              onClick={retirar}
              disabled={retirando || !prof?.saldo_pendiente || prof.saldo_pendiente <= 0}
              className="gap-2 h-12 px-6"
            >
              {retirando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                : <><ArrowDownToLine className="h-4 w-4" /> Retirar a mi cuenta</>
              }
            </Button>
          </div>
          {!prof?.cuenta_verificada && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Configura tus datos de cobro en <button className="underline font-medium" onClick={() => router.push("/profesional/perfil")}>tu perfil</button> para poder retirar fondos.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-primary-600" />
            Historial de cobros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transacciones.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Euro className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>Aún no tienes cobros registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transacciones.map((tx) => {
                const badge = ESTADO_BADGE[tx.estado] || { label: tx.estado, variant: "secondary" as const }
                return (
                  <div key={tx.id} className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        {tx.estado === "completada" ? <CheckCircle className="h-5 w-5 text-success" /> : <Clock className="h-5 w-5 text-primary-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{formatEuros(tx.importe_neto)} netos</p>
                        <p className="text-xs text-gray-400 truncate">{formatDate(tx.creado_en)} · {tx.metodo.replace("_", " ")} · ref: {tx.referencia_externa || `TX-${tx.id}`}</p>
                        {tx.estado === "congelada" && (
                          <p className="text-xs text-amber-600 mt-0.5">Liberación automática en 24h por política antifraude</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {(tx.estado === "completada") && (
                        <Button variant="ghost" size="sm" onClick={() => descargarFactura(tx)} className="gap-1 text-xs">
                          <Download className="h-3 w-3" /> PDF
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
