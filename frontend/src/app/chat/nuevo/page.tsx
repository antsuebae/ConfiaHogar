"use client"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

export default function NuevoChatPage() {
  const { usuario } = useAuthStore()
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const profId = params.get("profesional")
    if (!usuario) { router.push("/login"); return }
    if (!profId) { router.push("/chat"); return }
    api.post("/mensajes/conversaciones", { profesional_id: Number(profId) })
      .then((r) => router.replace(`/chat?activa=${r.data.id}`))
      .catch(() => router.push("/chat"))
  }, [usuario, params])

  return <div className="flex justify-center py-20 text-gray-400">Abriendo conversación...</div>
}
