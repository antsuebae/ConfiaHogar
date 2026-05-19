"use client"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Home, User, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import toast from "react-hot-toast"

const schema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  apellidos: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe incluir una mayúscula")
    .regex(/[0-9]/, "Debe incluir un número"),
  rol: z.enum(["cliente", "profesional"]),
})

type Form = z.infer<typeof schema>

export default function RegistroPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { setAuth } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const defaultRol = (params.get("rol") === "profesional" ? "profesional" : "cliente") as "cliente" | "profesional"

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { rol: defaultRol },
  })

  const rol = watch("rol")

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const res = await api.post("/auth/registro", data)
      setAuth(res.data.usuario, res.data.access_token)
      toast.success("Cuenta creada. ¡Bienvenido!")
      router.push(data.rol === "profesional" ? "/profesional/perfil" : "/buscar")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      toast.error(e.response?.data?.detail || "Error al crear la cuenta")
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
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <p className="text-sm text-gray-500">Únete a CONFIAHOGAR</p>
        </CardHeader>
        <CardContent>
          {/* Selector de rol */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(["cliente", "profesional"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setValue("rol", r)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  rol === r ? "border-primary-600 bg-primary-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {r === "cliente" ? <User className="h-6 w-6 text-primary-600" /> : <Wrench className="h-6 w-6 text-primary-600" />}
                <span className="text-sm font-medium capitalize">{r}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Nombre *</label>
                <Input {...register("nombre")} placeholder="María" className="mt-1" />
                {errors.nombre && <p className="text-xs text-danger mt-1">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Apellidos</label>
                <Input {...register("apellidos")} placeholder="García" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email *</label>
              <Input {...register("email")} type="email" placeholder="tu@email.com" className="mt-1" />
              {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Contraseña *</label>
              <div className="relative mt-1">
                <Input {...register("password")} type={showPass ? "text" : "password"} placeholder="Mín. 8 car., 1 mayúsc., 1 núm." className="pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary-600 font-medium hover:underline">Iniciar sesión</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
