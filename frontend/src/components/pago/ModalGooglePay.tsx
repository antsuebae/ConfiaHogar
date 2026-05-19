"use client"
import { useState } from "react"
import { CreditCard, CheckCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatEuros } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  citaId: number
  importe: number
  onSuccess: () => void
}

type Estado = "idle" | "procesando" | "ok" | "error"

export function ModalGooglePay({ open, onClose, citaId, importe, onSuccess }: Props) {
  const [estado, setEstado] = useState<Estado>("idle")
  const [error, setError] = useState("")

  const pagar = async () => {
    setEstado("procesando")
    setError("")
    try {
      await new Promise((r) => setTimeout(r, 2000)) // Simular latencia
      await api.post("/pagos/google-pay", { cita_id: citaId, importe })
      setEstado("ok")
      setTimeout(() => {
        onSuccess()
        onClose()
        setEstado("idle")
      }, 1500)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || "Google Pay ha rechazado el método. Estado: Pendiente de pago.")
      setEstado("error")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary-600" />
            Pagar con Google Pay
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {estado === "idle" && (
            <>
              <div className="rounded-xl bg-gray-50 border p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Importe total</p>
                <p className="text-3xl font-bold text-gray-900">{formatEuros(importe)}</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs text-blue-700">
                  Transacción segura y cifrada. Tus datos bancarios nunca se almacenan en nuestros servidores.
                </p>
              </div>
              <Button onClick={pagar} className="w-full h-12 text-base gap-3 bg-[#4285F4] hover:bg-[#3367D6]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Pagar con Google Pay
              </Button>
              <Button variant="outline" onClick={onClose} className="w-full">Cancelar</Button>
            </>
          )}

          {estado === "procesando" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-12 w-12 text-primary-600 animate-spin" />
              <p className="text-gray-600">Procesando pago...</p>
            </div>
          )}

          {estado === "ok" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="h-12 w-12 text-success" />
              <p className="font-semibold text-gray-900">Pago realizado con éxito</p>
              <p className="text-sm text-gray-500">{formatEuros(importe)} cobrados correctamente</p>
            </div>
          )}

          {estado === "error" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <Button onClick={() => setEstado("idle")} variant="outline" className="w-full">Reintentar</Button>
              <Button onClick={onClose} variant="ghost" className="w-full">Cancelar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
