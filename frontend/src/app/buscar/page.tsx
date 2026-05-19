"use client"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Search, MapPin, SlidersHorizontal, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TarjetaProfesional } from "@/components/busqueda/TarjetaProfesional"
import { api } from "@/lib/api"
import type { ProfesionalCard } from "@/types"
import toast from "react-hot-toast"

export default function BuscarPage() {
  const params = useSearchParams()
  const [profesion, setProfesion] = useState(params.get("profesion") || "")
  const [precioMax, setPrecioMax] = useState("")
  const [valoracionMin, setValoracionMin] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [resultados, setResultados] = useState<ProfesionalCard[]>([])
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)

  const buscar = async (usarGeo = false) => {
    setCargando(true)
    setBuscado(true)
    try {
      const queryParams: Record<string, string> = {}
      if (profesion) queryParams.profesion = profesion
      if (precioMax && !isNaN(Number(precioMax))) queryParams.precio_max = precioMax
      else if (precioMax) { toast.error("El precio debe ser un número"); setCargando(false); return }
      if (valoracionMin) queryParams.valoracion_min = valoracionMin
      if (usarGeo && lat !== null && lng !== null) {
        queryParams.lat = String(lat)
        queryParams.lng = String(lng)
        queryParams.radio_km = "5"
      }
      const res = await api.get("/profesionales/buscar", { params: queryParams })
      setResultados(res.data)
    } catch {
      toast.error("Error al buscar profesionales")
    } finally {
      setCargando(false)
    }
  }

  const usarGeolocalizacion = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        toast.success("Ubicación obtenida")
        buscar(true)
      },
      () => {
        toast.error("Ubicación denegada. Introduce tu código postal para buscar cerca.")
      }
    )
  }

  useEffect(() => {
    if (params.get("profesion")) buscar()
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Buscar profesional</h1>
        <p className="text-gray-500">Encuentra al profesional ideal para tu hogar</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-5 mb-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              value={profesion}
              onChange={(e) => setProfesion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="Fontanero, electricista, carpintero..."
              className="w-full"
            />
          </div>
          <Button onClick={() => buscar()} disabled={cargando} className="gap-2">
            <Search className="h-4 w-4" />
            {cargando ? "Buscando..." : "Buscar"}
          </Button>
          <Button variant="outline" onClick={usarGeolocalizacion} className="gap-2">
            <MapPin className="h-4 w-4" /> Cerca de mí
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtros:</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Precio máx (€/h):</label>
            <Input
              value={precioMax}
              onChange={(e) => setPrecioMax(e.target.value)}
              placeholder="ej: 50"
              className="w-24"
              type="number"
              min="0"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Valoración mín:</label>
            <select
              value={valoracionMin}
              onChange={(e) => setValoracionMin(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm"
            >
              <option value="">Cualquiera</option>
              <option value="3">3+ estrellas</option>
              <option value="4">4+ estrellas</option>
              <option value="4.5">4.5+ estrellas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {cargando && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      )}

      {!cargando && buscado && resultados.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">No se encontraron profesionales. Intenta ampliar la búsqueda.</p>
          <Button variant="outline" onClick={() => { setProfesion(""); setPrecioMax(""); setValoracionMin(""); buscar() }} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Mostrar todos
          </Button>
        </div>
      )}

      {!cargando && resultados.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">{resultados.length} profesionales encontrados</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resultados.map((p) => <TarjetaProfesional key={p.id} profesional={p} />)}
          </div>
        </div>
      )}

      {!cargando && !buscado && (
        <div className="text-center py-16 text-gray-400">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Busca por profesión o usa tu ubicación para ver profesionales cercanos</p>
        </div>
      )}
    </div>
  )
}
