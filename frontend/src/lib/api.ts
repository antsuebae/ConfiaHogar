import axios from "axios"
import { API_URL, WS_URL } from "@/lib/config"

export { WS_URL }

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
})

function getToken(): string | null {
  if (typeof window === "undefined") return null
  // Prefer in-memory Zustand state (fast path). Fall back to reading the
  // persisted Zustand key before hydration completes (synchronous).
  try {
    const { useAuthStore } = require("@/store/auth")
    const token = useAuthStore.getState().token
    if (token) return token
  } catch {}
  try {
    const raw = localStorage.getItem("confiahogar-auth")
    if (raw) return JSON.parse(raw).state?.token ?? null
  } catch {}
  return null
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      try {
        const { useAuthStore } = require("@/store/auth")
        useAuthStore.getState().logout()
      } catch {}
      localStorage.removeItem("confiahogar-auth")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)
