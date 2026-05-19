"use client"
import { useState, useEffect, useRef } from "react"
import { Send, Image as ImageIcon, FileText, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuthStore } from "@/store/auth"
import { useWebSocket } from "@/hooks/useWebSocket"
import { api } from "@/lib/api"
import type { Mensaje, Conversacion } from "@/types"
import { getInitials, formatDate } from "@/lib/utils"

interface Props {
  conversacion: Conversacion
}

export function ChatWindow({ conversacion }: Props) {
  const { usuario } = useAuthStore()
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const nombreOtro = usuario?.id === conversacion.cliente_id
    ? conversacion.nombre_profesional
    : conversacion.nombre_cliente
  const fotoOtro = usuario?.id === conversacion.cliente_id
    ? conversacion.foto_profesional
    : conversacion.foto_cliente

  const { send } = useWebSocket((data) => {
    if (data.tipo === "mensaje" && data.conversacion_id === conversacion.id) {
      const d = data.datos as Mensaje
      setMensajes((prev) => [...prev.filter(m => m.id !== d.id), d])
    }
    if (data.tipo === "leido" && data.conversacion_id === conversacion.id) {
      setMensajes((prev) => prev.map(m => ({ ...m, leido: true })))
    }
  })

  useEffect(() => {
    api.get(`/mensajes/conversaciones/${conversacion.id}/mensajes`)
      .then((r) => setMensajes(r.data))
      .catch(() => {})
  }, [conversacion.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    send({ tipo: "leido", conversacion_id: conversacion.id })
  }, [mensajes, conversacion.id, send])

  const enviarMensaje = async () => {
    if (!texto.trim() || enviando) return
    const contenido = texto.trim()
    setTexto("")
    setEnviando(true)
    send({ tipo: "mensaje", conversacion_id: conversacion.id, contenido })
    setEnviando(false)
  }

  const enviarImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert("La imagen supera el límite de 10MB")
      return
    }
    const form = new FormData()
    form.append("file", file)
    try {
      await api.post(`/mensajes/conversaciones/${conversacion.id}/imagen`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      const r = await api.get(`/mensajes/conversaciones/${conversacion.id}/mensajes`)
      setMensajes(r.data)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      alert(error.response?.data?.detail || "Error al enviar imagen")
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b p-4 bg-white">
        <Avatar>
          <AvatarImage src={fotoOtro} />
          <AvatarFallback>{getInitials(nombreOtro || "?")}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-gray-900">{nombreOtro}</p>
          <p className="text-xs text-gray-500">
            {usuario?.id === conversacion.cliente_id ? "Profesional" : "Cliente"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {mensajes.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p>Inicia la conversación enviando un mensaje</p>
          </div>
        )}
        {mensajes.map((m) => {
          const esMio = m.remitente_id === usuario?.id
          return (
            <div key={m.id} className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
              {!esMio && (
                <Avatar className="h-7 w-7 mr-2 flex-shrink-0 self-end">
                  <AvatarImage src={m.foto_remitente} />
                  <AvatarFallback className="text-xs">{getInitials(m.nombre_remitente || "?")}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  esMio
                    ? "bg-primary-600 text-white rounded-br-sm"
                    : "bg-white border text-gray-900 rounded-bl-sm shadow-sm"
                }`}
              >
                {m.tipo === "imagen" && m.imagen_url && (
                  <img
                    src={m.imagen_url}
                    alt="Imagen adjunta"
                    className="rounded-lg max-w-[200px] mb-1 cursor-pointer"
                    onClick={() => window.open(m.imagen_url, "_blank")}
                  />
                )}
                {m.tipo === "presupuesto" && m.contenido && (
                  <PresupuestoMensaje contenido={m.contenido} esMio={esMio} />
                )}
                {m.tipo === "texto" && <p className="text-sm">{m.contenido}</p>}
                <div className={`flex items-center gap-1 mt-1 ${esMio ? "justify-end" : "justify-start"}`}>
                  <span className={`text-xs ${esMio ? "text-primary-200" : "text-gray-400"}`}>
                    {new Date(m.creado_en).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {esMio && <CheckCheck className={`h-3 w-3 ${m.leido ? "text-blue-300" : "text-primary-300"}`} />}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4 bg-white">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={enviarImagen} />
            <Button variant="ghost" size="icon" asChild>
              <span><ImageIcon className="h-5 w-5 text-gray-500" /></span>
            </Button>
          </label>
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviarMensaje()}
            placeholder="Escribe un mensaje..."
            className="flex-1"
          />
          <Button onClick={enviarMensaje} disabled={!texto.trim() || enviando} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function PresupuestoMensaje({ contenido, esMio }: { contenido: string; esMio: boolean }) {
  try {
    const data = JSON.parse(contenido)
    return (
      <div className={`rounded-lg p-3 ${esMio ? "bg-primary-700" : "bg-accent-100 border border-accent-500"}`}>
        <div className="flex items-center gap-2 mb-1">
          <FileText className={`h-4 w-4 ${esMio ? "text-primary-200" : "text-accent-500"}`} />
          <span className={`text-xs font-semibold ${esMio ? "text-primary-200" : "text-accent-500"}`}>Presupuesto</span>
        </div>
        <p className={`text-lg font-bold ${esMio ? "text-white" : "text-gray-900"}`}>{data.importe}€</p>
        {data.concepto && <p className={`text-sm mt-1 ${esMio ? "text-primary-200" : "text-gray-600"}`}>{data.concepto}</p>}
      </div>
    )
  } catch {
    return <p className="text-sm">{contenido}</p>
  }
}
