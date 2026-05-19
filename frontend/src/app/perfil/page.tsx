"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Camera, Save, Trash2, CreditCard, AlertTriangle, Euro } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { getInitials, formatEuros } from "@/lib/utils"
import toast from "react-hot-toast"

export default function PerfilClientePage() {
  const { usuario, updateUsuario, logout } = useAuthStore()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [nombre, setNombre] = useState(usuario?.nombre || "")
  const [descripcion, setDescripcion] = useState(usuario?.descripcion || "")
  const [iban, setIban] = useState("")
  const [importe, setImporte] = useState("")
  const [showEliminar, setShowEliminar] = useState(false)
  const [confirmacion, setConfirmacion] = useState("")
  const [saving, setSaving] = useState(false)

  if (!usuario) { router.push("/login"); return null }

  const MAX_DESC = 1000
  const descRestantes = MAX_DESC - descripcion.length

  const guardarPerfil = async () => {
    setSaving(true)
    try {
      const res = await api.put("/usuarios/me", { nombre, descripcion })
      updateUsuario(res.data)
      toast.success("Perfil actualizado")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al guardar")
    } finally { setSaving(false) }
  }

  const cambiarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append("file", file)
    try {
      const res = await api.post("/usuarios/me/foto", form, { headers: { "Content-Type": "multipart/form-data" } })
      updateUsuario({ foto_perfil_url: res.data.foto_perfil_url })
      toast.success("Foto actualizada")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al subir la foto")
    }
  }

  const borrarFoto = async () => {
    try {
      await api.delete("/usuarios/me/foto")
      updateUsuario({ foto_perfil_url: undefined })
      toast.success("Foto eliminada")
    } catch { toast.error("Error") }
  }

  const recargarSaldo = async () => {
    if (!importe || isNaN(Number(importe)) || Number(importe) <= 0) {
      toast.error("Introduce un importe válido")
      return
    }
    try {
      const res = await api.post("/usuarios/me/recargar-saldo", { importe: Number(importe) })
      updateUsuario({ saldo: res.data.saldo })
      toast.success("Saldo añadido correctamente")
      setImporte("")
    } catch { toast.error("El cargo en la tarjeta ha fallado. Tu saldo no ha cambiado.") }
  }

  const guardarIban = async () => {
    try {
      const res = await api.post("/usuarios/me/datos-pago", { iban, titular: nombre })
      toast.success(`Datos de pago guardados (${res.data.iban_enmascarado})`)
      setIban("")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "IBAN inválido")
    }
  }

  const eliminarCuenta = async () => {
    if (confirmacion !== "ELIMINAR") {
      toast.error("Escribe exactamente 'ELIMINAR' para confirmar")
      return
    }
    try {
      await api.delete("/usuarios/me", { data: { confirmacion } })
      toast.success("Cuenta eliminada")
      logout()
      router.push("/")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al eliminar la cuenta")
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>

      {/* Foto y datos básicos */}
      <Card>
        <CardHeader><CardTitle>Información personal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={usuario.foto_perfil_url} />
                <AvatarFallback className="text-xl">{getInitials(usuario.nombre)}</AvatarFallback>
              </Avatar>
              <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-white hover:bg-primary-700">
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={cambiarFoto} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{usuario.nombre} {usuario.apellidos || ""}</p>
              <p className="text-sm text-gray-500">{usuario.email}</p>
              {usuario.foto_perfil_url && (
                <Button variant="ghost" size="sm" onClick={borrarFoto} className="mt-1 text-danger hover:text-red-700 p-0 h-auto">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar foto
                </Button>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-gray-700">Descripción</label>
              <span className={`text-xs ${descRestantes < 50 ? "text-danger" : "text-gray-400"}`}>{descRestantes} restantes</span>
            </div>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={MAX_DESC}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Cuéntanos algo sobre ti..."
            />
          </div>

          <Button onClick={guardarPerfil} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>

      {/* Saldo y pago */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Euro className="h-5 w-5" />Monedero</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-primary-50 border border-primary-200 p-4 text-center">
            <p className="text-sm text-primary-600">Saldo disponible</p>
            <p className="text-3xl font-bold text-primary-700">{formatEuros(usuario.saldo || 0)}</p>
          </div>
          <div className="flex gap-2">
            <Input value={importe} onChange={(e) => setImporte(e.target.value)} type="number" placeholder="Importe (€)" className="flex-1" min="0" />
            <Button onClick={recargarSaldo} variant="accent">Añadir fondos</Button>
          </div>
          <div className="flex gap-2">
            <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN (ej: ES9121000418450200051332)" className="flex-1" />
            <Button onClick={guardarIban} variant="outline" className="gap-2">
              <CreditCard className="h-4 w-4" /> Guardar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Zona peligrosa */}
      <Card className="border-red-200">
        <CardHeader><CardTitle className="text-danger flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Zona peligrosa</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={() => api.put("/usuarios/me/pausar").then(() => toast.success("Cuenta pausada temporalmente"))}>
            Pausar cuenta temporalmente
          </Button>
          <Button variant="destructive" onClick={() => setShowEliminar(true)}>
            Eliminar mi cuenta
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showEliminar} onOpenChange={setShowEliminar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-danger">¿Eliminar tu cuenta?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Esta acción es irreversible. Todos tus datos serán eliminados.</p>
            <p className="text-sm font-medium">Escribe <strong>ELIMINAR</strong> para confirmar:</p>
            <Input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="ELIMINAR" />
            <div className="flex gap-3">
              <Button variant="destructive" onClick={eliminarCuenta} className="flex-1" disabled={confirmacion !== "ELIMINAR"}>
                Confirmar eliminación
              </Button>
              <Button variant="outline" onClick={() => setShowEliminar(false)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
