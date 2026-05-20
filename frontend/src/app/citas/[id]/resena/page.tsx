"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Star, ImageIcon, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EstrellasPicker } from "@/components/resena/EstrellasPicker"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { Cita } from "@/types"
import toast from "react-hot-toast"

export default function DejarResenaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { usuario } = useAuthStore()
  const [cita, setCita] = useState<Cita | null>(null)
  const [estrellas, setEstrellas] = useState(0)
  const [comentario, setComentario] = useState("")
  const [imagen, setImagen] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    if (usuario.rol !== "cliente") { router.push("/profesional/dashboard"); return }
    api.get(`/citas/${id}`)
      .then((r) => setCita(r.data))
      .catch(() => toast.error("Cita no encontrada"))
      .finally(() => setCargando(false))
  }, [id, usuario, router])

  const seleccionarImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      toast.error("Solo se admiten imágenes JPG o PNG")
      return
    }
    setImagen(file)
    setPreview(URL.createObjectURL(file))
  }

  const enviar = async () => {
    if (estrellas < 1) {
      toast.error("Selecciona al menos 1 estrella")
      return
    }
    setEnviando(true)
    try {
      const prof = cita?.profesional_id
      if (!prof) throw new Error("Sin profesional")

      const res = await api.post("/resenas/", {
        profesional_id: prof,
        cita_id: Number(id),
        estrellas,
        comentario: comentario.trim() || undefined,
      })

      if (imagen) {
        const form = new FormData()
        form.append("file", imagen)
        await api.post(`/resenas/${res.data.id}/imagen`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      }

      setExito(true)
      setTimeout(() => router.push("/calendario"), 2500)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al enviar la reseña")
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
    </div>
  )

  if (exito) return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">¡Reseña publicada!</h2>
      <p className="text-gray-500">Gracias por valorar el servicio. Redirigiendo...</p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-accent-500" />
            Deja tu valoración
          </CardTitle>
          {cita && (
            <p className="text-sm text-gray-500">
              Servicio: <span className="font-medium text-gray-700">{cita.titulo || "Servicio contratado"}</span>
              {cita.nombre_profesional && <> · {cita.nombre_profesional}</>}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Estrellas */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Puntuación *</p>
            <EstrellasPicker value={estrellas} onChange={setEstrellas} size="lg" />
            {estrellas === 0 && <p className="text-xs text-gray-400 mt-1">Toca una estrella para valorar</p>}
          </div>

          {/* Comentario */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Comentario (opcional)</p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Describe tu experiencia con el profesional..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-primary-500"
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 text-right">{comentario.length}/1000</p>
          </div>

          {/* Imagen */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Foto del trabajo (opcional)</p>
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="Vista previa" className="rounded-lg h-32 object-cover" />
                <button
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  onClick={() => { setImagen(null); setPreview(null) }}
                >
                  ×
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-primary-400 transition-colors w-full">
                <ImageIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Adjuntar foto (JPG / PNG)</span>
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={seleccionarImagen} />
              </label>
            )}
          </div>

          <Button onClick={enviar} disabled={enviando || estrellas < 1} className="w-full">
            {enviando ? "Enviando..." : "Publicar reseña"}
          </Button>

          <Button variant="ghost" className="w-full text-gray-500" onClick={() => router.push("/calendario")}>
            Omitir por ahora
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
