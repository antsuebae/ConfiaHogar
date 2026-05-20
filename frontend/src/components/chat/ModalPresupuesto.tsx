"use client"
import { useState } from "react"
import { FileText } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import toast from "react-hot-toast"

interface Props {
  open: boolean
  onClose: () => void
  conversacionId: number
  presupuestoPadreId?: number
  importeInicial?: number
  onEnviado: () => void
}

export function ModalPresupuesto({ open, onClose, conversacionId, presupuestoPadreId, importeInicial, onEnviado }: Props) {
  const [importe, setImporte] = useState(importeInicial ? String(importeInicial) : "")
  const [concepto, setConcepto] = useState("")
  const [enviando, setEnviando] = useState(false)

  const esContraoferta = !!presupuestoPadreId

  const handleClose = () => {
    setImporte(importeInicial ? String(importeInicial) : "")
    setConcepto("")
    onClose()
  }

  const enviar = async () => {
    const val = parseFloat(importe)
    if (isNaN(val) || val <= 0) {
      toast.error("Introduce un importe válido mayor que 0")
      return
    }
    setEnviando(true)
    try {
      if (esContraoferta) {
        await api.post(`/presupuestos/${presupuestoPadreId}/contraofertar`, {
          conversacion_id: conversacionId,
          importe: val,
          concepto: concepto || undefined,
        })
        toast.success("Contraoferta enviada")
      } else {
        await api.post("/presupuestos/", {
          conversacion_id: conversacionId,
          importe: val,
          concepto: concepto || undefined,
        })
        toast.success("Presupuesto enviado")
      }
      handleClose()
      onEnviado()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al enviar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            {esContraoferta ? "Enviar contraoferta" : "Enviar presupuesto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="importe">Importe (€) *</Label>
            <Input
              id="importe"
              type="number"
              min="0.01"
              step="0.01"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="ej: 55.00"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="concepto">Concepto (opcional)</Label>
            <Input
              id="concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="ej: Reparación fuga bajo fregadero"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={enviar} disabled={enviando || !importe} className="flex-1">
              {enviando ? "Enviando..." : esContraoferta ? "Enviar contraoferta" : "Enviar presupuesto"}
            </Button>
            <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
