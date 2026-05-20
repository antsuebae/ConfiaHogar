import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Usuario } from "@/types"

interface AuthState {
  usuario: Usuario | null
  token: string | null
  setAuth: (usuario: Usuario, token: string) => void
  updateUsuario: (updates: Partial<Usuario>) => void
  logout: () => void
  isAuthenticated: boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      token: null,
      isAuthenticated: false,
      setAuth: (usuario, token) => {
        set({ usuario, token, isAuthenticated: true })
      },
      updateUsuario: (updates) => {
        const current = get().usuario
        if (current) set({ usuario: { ...current, ...updates } })
      },
      logout: () => {
        set({ usuario: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: "confiahogar-auth",
      partialize: (state) => ({ usuario: state.usuario, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
