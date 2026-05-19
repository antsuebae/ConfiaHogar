"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import toast from "react-hot-toast"

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
  recordar: z.boolean().optional(),
})

type Form = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const res = await api.post("/auth/login", { email: data.email, password: data.password, recordar_sesion: data.recordar })
      setAuth(res.data.usuario, res.data.access_token)
      toast.success("Sesión iniciada")
      router.push(res.data.usuario.rol === "profesional" ? "/profesional/dashboard" : "/buscar")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string }; status?: number } }
      const msg = e.response?.data?.detail || "Error al iniciar sesión"
      if (e.response?.status === 423) toast.error(msg, { duration: 8000 })
      else toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 to-white">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary-600 flex items-center justify-center mb-3">
            <Home className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Bienvenido a CONFIAHOGAR</CardTitle>
          <p className="text-sm text-gray-500">Inicia sesión en tu cuenta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input {...register("email")} type="email" placeholder="tu@email.com" className="mt-1" />
              {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Contraseña</label>
              <div className="relative mt-1">
                <Input {...register("password")} type={showPass ? "text" : "password"} placeholder="••••••••" className="pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("recordar")} className="rounded border-gray-300 text-primary-600" />
              <span className="text-sm text-gray-600">Recordar sesión</span>
            </label>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="text-primary-600 font-medium hover:underline">Regístrate gratis</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
