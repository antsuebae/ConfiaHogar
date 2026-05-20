"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import type { Conversacion } from "@/types"
import toast from "react-hot-toast"

export default function ChatDirectoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { usuario } = useAuthStore()
  const [conversacion, setConversacion] = useState<Conversacion | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario) { router.push("/login"); return }
    api.get(`/mensajes/conversaciones/${id}`)
      .then((r) => setConversacion(r.data))
      .catch(() => {
        toast.error("Conversación no encontrada")
        router.push("/chat")
      })
      .finally(() => setCargando(false))
  }, [id, usuario, router])

  if (cargando) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
    </div>
  )

  if (!conversacion) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl border overflow-hidden h-[calc(100vh-10rem)]">
        <ChatWindow conversacion={conversacion} />
      </div>
    </div>
  )
}
