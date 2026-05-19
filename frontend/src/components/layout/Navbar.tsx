"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, LogOut, User, Calendar, MessageSquare, Search, Home, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth"
import { useNotificacionesStore } from "@/store/notificaciones"
import { getInitials } from "@/lib/utils"

export function Navbar() {
  const { usuario, logout } = useAuthStore()
  const { noLeidas } = useNotificacionesStore()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const isCliente = usuario?.rol === "cliente"

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <Home className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-primary-700">CONFIAHOGAR</span>
          </Link>

          {usuario ? (
            <>
              <div className="hidden md:flex items-center gap-1">
                {isCliente ? (
                  <>
                    <Link href="/buscar">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Search className="h-4 w-4" /> Buscar
                      </Button>
                    </Link>
                    <Link href="/calendario">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Calendar className="h-4 w-4" /> Calendario
                      </Button>
                    </Link>
                    <Link href="/chat">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <MessageSquare className="h-4 w-4" /> Mensajes
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/profesional/dashboard">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Wrench className="h-4 w-4" /> Panel
                      </Button>
                    </Link>
                    <Link href="/profesional/calendario">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Calendar className="h-4 w-4" /> Agenda
                      </Button>
                    </Link>
                    <Link href="/chat">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <MessageSquare className="h-4 w-4" /> Mensajes
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link href="/notificaciones" className="relative">
                  <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5" />
                  </Button>
                  {noLeidas > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs text-white">
                      {noLeidas > 9 ? "9+" : noLeidas}
                    </span>
                  )}
                </Link>
                <Link href={isCliente ? "/perfil" : "/profesional/perfil"}>
                  <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-primary-200 hover:ring-primary-500 transition-all">
                    <AvatarImage src={usuario.foto_perfil_url} />
                    <AvatarFallback>{getInitials(usuario.nombre)}</AvatarFallback>
                  </Avatar>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
                  <LogOut className="h-4 w-4 text-gray-500" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="outline" size="sm">Iniciar sesión</Button>
              </Link>
              <Link href="/registro">
                <Button size="sm">Registrarse</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
