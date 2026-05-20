"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Camera, Save, Upload, CheckCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { getInitials } from "@/lib/utils"
import toast from "react-hot-toast"

export default function PerfilProfesionalEditPage() {
  const { usuario, updateUsuario, logout } = useAuthStore()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const certRef = useRef<HTMLInputElement>(null)
  const dniRef = useRef<HTMLInputElement>(null)

  const [profesion, setProfesion] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [tarifaHora, setTarifaHora] = useState("")
  const [ciudad, setCiudad] = useState("")
  const [iban, setIban] = useState("")
  const [nombreCert, setNombreCert] = useState("")
  const [disponible, setDisponible] = useState(true)
  const [visible, setVisible] = useState(true)
  const [showEliminar, setShowEliminar] = useState(false)
  const [confirmacion, setConfirmacion] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    if (usuario.rol !== "profesional") { router.push("/buscar"); return }
    api.get("/profesionales/me").then((r) => {
      const p = r.data
      setProfesion(p.profesion || "")
      setDescripcion(p.descripcion_profesional || "")
      setTarifaHora(p.tarifa_hora ? String(p.tarifa_hora) : "")
      setCiudad(p.ciudad || "")
      setDisponible(p.disponible)
      setVisible(p.perfil_visible)
    }).catch(() => {})
  }, [usuario])

  const guardar = async () => {
    setSaving(true)
    try {
      await api.put("/profesionales/me", {
        profesion,
        descripcion_profesional: descripcion,
        tarifa_hora: tarifaHora ? Number(tarifaHora) : undefined,
        ciudad,
        disponible,
        perfil_visible: visible,
      })
      toast.success("Perfil actualizado")
    } catch { toast.error("Error al guardar") }
    finally { setSaving(false) }
  }

  const cambiarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const form = new FormData(); form.append("file", file)
    try {
      const res = await api.post("/usuarios/me/foto", form, { headers: { "Content-Type": "multipart/form-data" } })
      updateUsuario({ foto_perfil_url: res.data.foto_perfil_url })
      toast.success("Foto actualizada")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error")
    }
  }

  const subirCertificacion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !nombreCert) { toast.error("Introduce el nombre del certificado primero"); return }
    const form = new FormData(); form.append("file", file)
    try {
      await api.post(`/profesionales/me/certificaciones?nombre=${encodeURIComponent(nombreCert)}`, form, { headers: { "Content-Type": "multipart/form-data" } })
      toast.success("Certificación enviada para revisión")
      setNombreCert("")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error")
    }
  }

  const verificarCuenta = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const form = new FormData(); form.append("file", file)
    try {
      await api.post("/profesionales/me/verificar", form, { headers: { "Content-Type": "multipart/form-data" } })
      toast.success("DNI enviado. Recibirás la insignia Verificado tras la revisión.")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al subir el DNI")
    }
  }

  const guardarIban = async () => {
    try {
      const res = await api.post("/profesionales/me/datos-cobro", { iban, titular: usuario?.nombre || "" })
      toast.success(`Datos de cobro guardados (${res.data.iban_enmascarado})`)
      setIban("")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "IBAN inválido")
    }
  }

  const eliminarCuenta = async () => {
    try {
      await api.delete("/usuarios/me", { data: { confirmacion } })
      logout(); router.push("/")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error")
    }
  }

  const MAX_DESC = 1000
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mi Perfil Profesional</h1>

      {/* Foto */}
      <Card>
        <CardHeader><CardTitle>Foto de perfil</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={usuario?.foto_perfil_url} />
              <AvatarFallback className="text-xl">{getInitials(usuario?.nombre || "")}</AvatarFallback>
            </Avatar>
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-white hover:bg-primary-700">
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={cambiarFoto} />
          </div>
          <p className="text-sm text-gray-500">Mín. 400x400px. JPG o PNG.</p>
        </CardContent>
      </Card>

      {/* Info profesional */}
      <Card>
        <CardHeader><CardTitle>Datos profesionales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="prof-profesion" className="text-sm font-medium text-gray-700">Profesión</label>
            <Input id="prof-profesion" value={profesion} onChange={(e) => setProfesion(e.target.value)} className="mt-1" placeholder="Fontanero, Electricista..." />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label htmlFor="prof-descripcion" className="text-sm font-medium text-gray-700">Descripción</label>
              <span className={`text-xs ${MAX_DESC - descripcion.length < 50 ? "text-danger" : "text-gray-400"}`}>{MAX_DESC - descripcion.length} restantes</span>
            </div>
            <textarea id="prof-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={MAX_DESC} rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Describe tus servicios, experiencia, especialidades..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prof-tarifa" className="text-sm font-medium text-gray-700">Tarifa/hora (€)</label>
              <Input id="prof-tarifa" value={tarifaHora} onChange={(e) => setTarifaHora(e.target.value)} type="number" min="0" className="mt-1" />
            </div>
            <div>
              <label htmlFor="prof-ciudad" className="text-sm font-medium text-gray-700">Ciudad</label>
              <Input id="prof-ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} className="mt-1" placeholder="Sevilla" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={disponible} onChange={(e) => setDisponible(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">Disponible</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-700">Perfil visible</span>
            </label>
          </div>
          <Button onClick={guardar} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>

      {/* Verificación */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-success" />Verificar cuenta</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">Sube una foto de tu DNI para obtener la insignia "Verificado".</p>
          <Button variant="outline" onClick={() => dniRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" /> Subir DNI
          </Button>
          <input ref={dniRef} type="file" accept="image/*" className="hidden" onChange={verificarCuenta} />
        </CardContent>
      </Card>

      {/* Certificaciones */}
      <Card>
        <CardHeader><CardTitle>Añadir certificación</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={nombreCert} onChange={(e) => setNombreCert(e.target.value)} placeholder="Nombre del certificado (ej: Instalador eléctrico autorizado)" />
          <Button variant="outline" onClick={() => certRef.current?.click()} disabled={!nombreCert} className="gap-2">
            <Upload className="h-4 w-4" /> Subir documento (PDF/JPG/PNG)
          </Button>
          <input ref={certRef} type="file" accept=".pdf,image/*" className="hidden" onChange={subirCertificacion} />
        </CardContent>
      </Card>

      {/* Datos de cobro */}
      <Card>
        <CardHeader><CardTitle>Datos de cobro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">Introduce tu IBAN para recibir los pagos de tus servicios.</p>
          <div className="flex gap-2">
            <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="ES9121000418450200051332" className="flex-1" />
            <Button onClick={guardarIban} variant="outline">Guardar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Zona peligrosa */}
      <Card className="border-red-200">
        <CardHeader><CardTitle className="text-danger flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Zona peligrosa</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setShowEliminar(true)}>Eliminar mi cuenta</Button>
        </CardContent>
      </Card>

      <Dialog open={showEliminar} onOpenChange={setShowEliminar}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-danger">¿Eliminar tu cuenta?</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Escribe <strong>ELIMINAR</strong> para confirmar:</p>
            <Input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="ELIMINAR" />
            <div className="flex gap-3">
              <Button variant="destructive" onClick={eliminarCuenta} className="flex-1" disabled={confirmacion !== "ELIMINAR"}>Confirmar</Button>
              <Button variant="outline" onClick={() => setShowEliminar(false)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
