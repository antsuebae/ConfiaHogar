import { create } from "zustand"
import type { Notificacion } from "@/types"

interface NotificacionesState {
  notificaciones: Notificacion[]
  noLeidas: number
  setNotificaciones: (n: Notificacion[]) => void
  addNotificacion: (n: Notificacion) => void
  setNoLeidas: (count: number) => void
  marcarLeida: (id: number) => void
}

export const useNotificacionesStore = create<NotificacionesState>((set, get) => ({
  notificaciones: [],
  noLeidas: 0,
  setNotificaciones: (notificaciones) => set({ notificaciones, noLeidas: notificaciones.filter(n => !n.leida).length }),
  addNotificacion: (n) => set((s) => ({ notificaciones: [n, ...s.notificaciones], noLeidas: s.noLeidas + 1 })),
  setNoLeidas: (count) => set({ noLeidas: count }),
  marcarLeida: (id) => set((s) => ({
    notificaciones: s.notificaciones.map(n => n.id === id ? { ...n, leida: true } : n),
    noLeidas: Math.max(0, s.noLeidas - 1),
  })),
}))
