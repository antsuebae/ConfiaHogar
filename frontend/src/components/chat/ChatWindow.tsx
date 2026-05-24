"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Send, Image as ImageIcon, FileText, CheckCheck, Euro, CalendarDays, Banknote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ModalPresupuesto } from "@/components/chat/ModalPresupuesto"
import { ModalGooglePay } from "@/components/pago/ModalGooglePay"
import { useAuthStore } from "@/store/auth"
import { useWebSocket } from "@/hooks/useWebSocket"
import { api } from "@/lib/api"
import type { Mensaje, Conversacion, Presupuesto } from "@/types"
import { getInitials } from "@/lib/utils"
import toast from "react-hot-toast"

interface Props {
  conversacion: Conversacion
}

export function ChatWindow({ conversacion }: Props) {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [presupuestos, setPresupuestos] = useState<Map<number, Presupuesto>>(new Map())
  const [modalPresupuesto, setModalPresupuesto] = useState(false)
  const [contraofertaDe, setContraofertaDe] = useState<Presupuesto | null>(null)
  const [pagarPresupuesto, setPagarPresupuesto] = useState<Presupuesto | null>(null)
  const [modalFecha, setModalFecha] = useState<Presupuesto | null>(null)
  const [modalFechaEfectivo, setModalFechaEfectivo] = useState<Presupuesto | null>(null)
  const [fechasCita, setFechasCita] = useState<Map<number, string>>(new Map())
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const esProfesional = usuario?.rol === "profesional"
  const nombreOtro = usuario?.id === conversacion.cliente_id
    ? conversacion.nombre_profesional
    : conversacion.nombre_cliente
  const fotoOtro = usuario?.id === conversacion.cliente_id
    ? conversacion.foto_profesional
    : conversacion.foto_cliente

  const cargarPresupuestos = async () => {
    try {
      const r = await api.get(`/presupuestos/conversacion/${conversacion.id}`)
      const mapa = new Map<number, Presupuesto>()
      for (const p of r.data as Presupuesto[]) mapa.set(p.id, p)
      setPresupuestos(mapa)
    } catch { /* silent */ }
  }

  const { send } = useWebSocket((data) => {
    if (data.tipo === "mensaje" && data.conversacion_id === conversacion.id) {
      const d = data.datos as Mensaje
      setMensajes((prev) => [...prev.filter(m => m.id !== d.id), d])
    }
    if (data.tipo === "leido" && data.conversacion_id === conversacion.id) {
      setMensajes((prev) => prev.map(m => ({ ...m, leido: true })))
    }
    if (data.tipo === "presupuesto" && data.conversacion_id === conversacion.id) {
      cargarPresupuestos()
      api.get(`/mensajes/conversaciones/${conversacion.id}/mensajes`).then((r) => setMensajes(r.data)).catch(() => {})
    }
  })

  useEffect(() => {
    setMensajes([])
    setPresupuestos(new Map())
    setFechasCita(new Map())
    setPagarPresupuesto(null)
    setModalFecha(null)
    setContraofertaDe(null)
    api.get(`/mensajes/conversaciones/${conversacion.id}/mensajes`)
      .then((r) => setMensajes(r.data))
      .catch(() => {})
    cargarPresupuestos()
  }, [conversacion.id])

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    send({ tipo: "leido", conversacion_id: conversacion.id })
  }, [mensajes, conversacion.id, send])

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  const enviarMensaje = async () => {
    if (!texto.trim() || enviando) return
    const contenido = texto.trim()
    setTexto("")
    setEnviando(true)
    isAtBottomRef.current = true  // own message always scrolls to bottom
    send({ tipo: "mensaje", conversacion_id: conversacion.id, contenido })
    setEnviando(false)
  }

  const enviarImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen supera el límite de 10MB")
      return
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se admiten imágenes JPG y PNG")
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
      toast.error(error.response?.data?.detail || "Error al enviar imagen")
    }
  }

  const aceptarPresupuesto = async (p: Presupuesto) => {
    try {
      await api.put(`/presupuestos/${p.id}/aceptar`)
      toast.success("Presupuesto aceptado")
      cargarPresupuestos()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al aceptar")
    }
  }

  const iniciarPago = (p: Presupuesto) => {
    setModalFecha(p)
  }

  const confirmarFechaYPagar = (p: Presupuesto, fecha: string) => {
    setFechasCita((prev) => new Map(prev).set(p.id, fecha))
    setModalFecha(null)
    setPagarPresupuesto(p)
  }

  const rechazarPresupuesto = async (p: Presupuesto) => {
    try {
      await api.put(`/presupuestos/${p.id}/rechazar`)
      toast("Presupuesto rechazado", { icon: "✖️" })
      cargarPresupuestos()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al rechazar")
    }
  }

  const onPagoExitoso = (citaId?: number) => {
    toast.success("¡Pago realizado! Tu cita está confirmada.")
    cargarPresupuestos()
    if (citaId) {
      setTimeout(() => router.push(`/citas/${citaId}`), 1500)
    }
  }

  const confirmarFechaEfectivo = async (p: Presupuesto, fecha: string) => {
    setModalFechaEfectivo(null)
    try {
      await api.post(`/pagos/presupuesto/${p.id}/efectivo`, { fecha_inicio: fecha })
      toast.success("¡Cita creada! Paga en efectivo al profesional el día del servicio.")
      cargarPresupuestos()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al registrar pago en efectivo")
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
      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
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
                    role="button"
                    tabIndex={0}
                    className="rounded-lg max-w-[200px] mb-1 cursor-pointer"
                    onClick={() => window.open(m.imagen_url, "_blank")}
                    onKeyDown={(e) => e.key === "Enter" && window.open(m.imagen_url, "_blank")}
                  />
                )}
                {m.tipo === "presupuesto" && m.contenido && (
                  <PresupuestoMensaje
                    contenido={m.contenido}
                    esMio={esMio}
                    presupuestos={presupuestos}
                    usuarioRol={(usuario?.rol === "profesional" ? "profesional" : "cliente")}
                    onAceptar={aceptarPresupuesto}
                    onRechazar={rechazarPresupuesto}
                    onContraofertar={(p) => { setContraofertaDe(p); setModalPresupuesto(true) }}
                    onPagar={iniciarPago}
                    onPagarEfectivo={(p) => setModalFechaEfectivo(p)}
                  />
                )}
                {m.tipo === "texto" && (
                  <p className="text-sm whitespace-pre-wrap">
                    {renderConLinks(m.contenido || "", esMio)}
                  </p>
                )}
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
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={enviarImagen} />
            <Button variant="ghost" size="icon" asChild>
              <span><ImageIcon className="h-5 w-5 text-gray-500" /></span>
            </Button>
          </label>
          {esProfesional && (
            <Button
              variant="ghost"
              size="icon"
              title="Enviar presupuesto"
              onClick={() => { setContraofertaDe(null); setModalPresupuesto(true) }}
            >
              <Euro className="h-5 w-5 text-gray-500" />
            </Button>
          )}
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

      {/* Modals */}
      <ModalPresupuesto
        open={modalPresupuesto}
        onClose={() => { setModalPresupuesto(false); setContraofertaDe(null) }}
        conversacionId={conversacion.id}
        presupuestoPadreId={contraofertaDe?.id}
        importeInicial={contraofertaDe?.importe}
        onEnviado={() => {
          cargarPresupuestos()
          api.get(`/mensajes/conversaciones/${conversacion.id}/mensajes`).then((r) => setMensajes(r.data)).catch(() => {})
        }}
      />

      {pagarPresupuesto && (
        <ModalGooglePay
          open={!!pagarPresupuesto}
          onClose={() => setPagarPresupuesto(null)}
          presupuestoId={pagarPresupuesto.id}
          importe={pagarPresupuesto.importe}
          fechaInicio={fechasCita.get(pagarPresupuesto.id)}
          onSuccess={onPagoExitoso}
        />
      )}

      <ModalFechaCita
        presupuesto={modalFecha}
        conversacion={conversacion}
        onClose={() => setModalFecha(null)}
        onConfirmar={confirmarFechaYPagar}
      />

      <ModalFechaCita
        presupuesto={modalFechaEfectivo}
        conversacion={conversacion}
        onClose={() => setModalFechaEfectivo(null)}
        onConfirmar={confirmarFechaEfectivo}
        titulo="Elige fecha — Pago en efectivo"
        labelConfirmar="Confirmar cita (pagaré en efectivo)"
      />
    </div>
  )
}

const URL_SPLIT = /(https?:\/\/[^\s]+)/g
const URL_TEST = /^https?:\/\/[^\s]+$/

function renderConLinks(texto: string, esMio: boolean) {
  const parts = texto.split(URL_SPLIT)
  return parts.map((part, i) =>
    URL_TEST.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline ${esMio ? "text-primary-100" : "text-primary-600"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : part
  )
}

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  enviado:   { label: "Enviado",   color: "bg-yellow-100 text-yellow-800" },
  aceptado:  { label: "Aceptado",  color: "bg-green-100 text-green-800" },
  rechazado: { label: "Rechazado", color: "bg-red-100 text-red-800" },
  pagado:    { label: "Pagado",    color: "bg-purple-100 text-purple-800" },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-600" },
  borrador:  { label: "Borrador",  color: "bg-gray-100 text-gray-600" },
}

function PresupuestoMensaje({
  contenido,
  esMio,
  presupuestos,
  usuarioRol,
  onAceptar,
  onRechazar,
  onContraofertar,
  onPagar,
  onPagarEfectivo,
}: {
  contenido: string
  esMio: boolean
  presupuestos: Map<number, Presupuesto>
  usuarioRol: "cliente" | "profesional"
  onAceptar: (p: Presupuesto) => void
  onRechazar: (p: Presupuesto) => void
  onContraofertar: (p: Presupuesto) => void
  onPagar: (p: Presupuesto) => void
  onPagarEfectivo: (p: Presupuesto) => void
}) {
  try {
    const data = JSON.parse(contenido)
    const presupuesto = data.presupuesto_id ? presupuestos.get(data.presupuesto_id) : null
    const estado = presupuesto?.estado || "enviado"
    const estadoInfo = ESTADO_BADGE[estado] || ESTADO_BADGE.enviado

    // El receptor puede actuar: si esMio=false (mensaje del otro), o sea recibí este presupuesto
    const esReceptor = !esMio
    const puedeActuar = esReceptor && estado === "enviado"
    const puedePagar = usuarioRol === "cliente" && estado === "aceptado"

    return (
      <div className={`rounded-lg p-3 w-full ${esMio ? "bg-primary-700" : "bg-accent-100 border border-accent-500"}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1">
            <FileText className={`h-4 w-4 ${esMio ? "text-primary-200" : "text-accent-500"}`} />
            <span className={`text-xs font-semibold ${esMio ? "text-primary-200" : "text-accent-500"}`}>Presupuesto</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoInfo.color}`}>
            {estadoInfo.label}
          </span>
        </div>
        <p className={`text-lg font-bold ${esMio ? "text-white" : "text-gray-900"}`}>{data.importe}€</p>
        {data.concepto && <p className={`text-sm mt-1 ${esMio ? "text-primary-200" : "text-gray-600"}`}>{data.concepto}</p>}

        {puedeActuar && presupuesto && (
          <div className="flex flex-col gap-2 mt-3">
            <Button className="w-full bg-green-600 hover:bg-green-700 text-base font-semibold py-5" onClick={() => onAceptar(presupuesto)}>
              Aceptar presupuesto
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onContraofertar(presupuesto)}>
                Contraofertar
              </Button>
              <Button size="sm" variant="ghost" className="flex-1 text-xs text-red-600 hover:text-red-700" onClick={() => onRechazar(presupuesto)}>
                Rechazar
              </Button>
            </div>
          </div>
        )}

        {puedePagar && presupuesto && (
          <div className="flex flex-col gap-2 mt-3">
            <Button
              className="w-full gap-1"
              onClick={() => onPagar(presupuesto)}
            >
              <CalendarDays className="h-4 w-4" />
              Elegir fecha y pagar
            </Button>
            <Button
              variant="outline"
              className="w-full gap-1"
              onClick={() => onPagarEfectivo(presupuesto)}
            >
              <Banknote className="h-4 w-4" />
              Pagar en efectivo
            </Button>
          </div>
        )}
      </div>
    )
  } catch {
    return <p className="text-sm">{contenido}</p>
  }
}

const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

function ModalFechaCita({
  presupuesto,
  conversacion,
  onClose,
  onConfirmar,
  titulo = "Elige fecha y hora para el servicio",
  labelConfirmar = "Continuar al pago",
}: {
  presupuesto: Presupuesto | null
  conversacion: Conversacion
  onClose: () => void
  onConfirmar: (p: Presupuesto, fecha: string) => void
  titulo?: string
  labelConfirmar?: string
}) {
  const [slots, setSlots] = useState<string[]>([])
  const [cargando, setCargando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [diaActivo, setDiaActivo] = useState<string | null>(null)

  useEffect(() => {
    if (!presupuesto) return
    setCargando(true)
    setSeleccionado(null)
    setDiaActivo(null)
    api.get(`/disponibilidad/profesionales/${conversacion.profesional_id}/slots?semanas=4`)
      .then(r => {
        setSlots(r.data)
        if (r.data.length > 0) {
          setDiaActivo(r.data[0].slice(0, 10))
        }
      })
      .catch(() => setSlots([]))
      .finally(() => setCargando(false))
  }, [presupuesto?.id])

  if (!presupuesto) return null

  // Group slots by date
  const porDia: Record<string, string[]> = {}
  for (const s of slots) {
    const dia = s.slice(0, 10)
    if (!porDia[dia]) porDia[dia] = []
    porDia[dia].push(s)
  }
  const dias = Object.keys(porDia).sort()
  const slotsDia = diaActivo ? (porDia[diaActivo] || []) : []

  return (
    <Dialog open={!!presupuesto} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-full overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary-600" />
            {titulo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 min-w-0">
          <div className="rounded-lg bg-gray-50 border px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Presupuesto</p>
              <p className="font-bold text-gray-900">{presupuesto.importe}€</p>
            </div>
            {presupuesto.concepto && <p className="text-sm text-gray-500 max-w-[180px] truncate">{presupuesto.concepto}</p>}
          </div>

          {cargando && (
            <div className="text-center py-6 text-sm text-gray-400">Cargando disponibilidad...</div>
          )}

          {!cargando && slots.length === 0 && (
            <div className="text-center py-6 text-sm text-gray-500 space-y-2">
              <CalendarDays className="h-8 w-8 mx-auto text-gray-300" />
              <p>El profesional aún no ha definido su disponibilidad.</p>
              <p className="text-xs text-gray-400">Puedes contactarle por chat para acordar una fecha.</p>
            </div>
          )}

          {!cargando && slots.length > 0 && (
            <>
              {/* Day picker */}
              <div className="w-full overflow-x-auto pb-1">
                <div className="flex gap-2">
                {dias.map(dia => {
                  const d = new Date(dia + "T12:00:00")
                  const activo = diaActivo === dia
                  return (
                    <button
                      key={dia}
                      onClick={() => { setDiaActivo(dia); setSeleccionado(null) }}
                      className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-colors ${
                        activo ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-medium">{DIAS_CORTO[d.getDay()]}</span>
                      <span>{d.getDate()}/{d.getMonth() + 1}</span>
                    </button>
                  )
                })}
                </div>
              </div>

              {/* Hour slots */}
              <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto w-full">
                {slotsDia.map(slot => {
                  const hora = new Date(slot).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
                  const activo = seleccionado === slot
                  return (
                    <button
                      key={slot}
                      onClick={() => setSeleccionado(slot)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        activo ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-700 hover:bg-primary-50 border-gray-200"
                      }`}
                    >
                      {hora}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <Button
            className="w-full"
            onClick={() => seleccionado && onConfirmar(presupuesto, new Date(seleccionado).toISOString())}
            disabled={!seleccionado}
          >
            {labelConfirmar}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
