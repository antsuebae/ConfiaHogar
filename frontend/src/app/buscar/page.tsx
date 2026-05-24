"use client"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Search, MapPin, SlidersHorizontal, Loader2, RefreshCw, Zap } from "lucide-react"
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
  const [soloUrgencias, setSoloUrgencias] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [codigoPostal, setCodigoPostal] = useState("")
  const [mostrarCp, setMostrarCp] = useState(false)
  const [resultados, setResultados] = useState<ProfesionalCard[]>([])
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)

  // Minimal CP→lat/lng table for demo (major Spanish cities)
  const CP_TABLE: Record<string, [number, number]> = {
    "28001": [40.4168, -3.7038], "28080": [40.4168, -3.7038],
    "41001": [37.3891, -5.9845], "41004": [37.3891, -5.9845],
    "08001": [41.3851, 2.1734],  "08080": [41.3851, 2.1734],
    "46001": [39.4699, -0.3763], "46080": [39.4699, -0.3763],
    "29001": [36.7213, -4.4213], "29080": [36.7213, -4.4213],
    "15001": [43.3623, -8.4115], "15080": [43.3623, -8.4115],
    "50001": [41.6561, -0.8773], "50080": [41.6561, -0.8773],
  }

  const buscar = async (usarGeo = false, latOverride?: number, lngOverride?: number) => {
    setCargando(true)
    setBuscado(true)
    try {
      const queryParams: Record<string, string> = {}
      if (profesion) queryParams.profesion = profesion
      if (precioMax && !isNaN(Number(precioMax))) queryParams.precio_max = precioMax
      else if (precioMax) { toast.error("El precio debe ser un número"); setCargando(false); return }
      if (valoracionMin) queryParams.valoracion_min = valoracionMin
      if (soloUrgencias) queryParams.urgencias = "true"
      const latFinal = latOverride ?? lat
      const lngFinal = lngOverride ?? lng
      if (usarGeo && latFinal !== null && lngFinal !== null) {
        queryParams.lat = String(latFinal)
        queryParams.lng = String(lngFinal)
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

  const buscarPorCp = () => {
    const cp = codigoPostal.trim()
    if (cp.length !== 5 || !/^\d{5}$/.test(cp)) {
      toast.error("Introduce un código postal válido de 5 dígitos")
      return
    }
    const coords = CP_TABLE[cp]
    if (!coords) {
      toast.error("Código postal no reconocido. Prueba con la ciudad en el buscador.")
      return
    }
    const [latCp, lngCp] = coords
    setLat(latCp)
    setLng(lngCp)
    buscar(true, latCp, lngCp)
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
        buscar(true, pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setMostrarCp(true)
        toast.error("Ubicación denegada. Introduce tu código postal.")
      }
    )
  }

  useEffect(() => {
    if (params.get("profesion")) buscar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("profesion")])

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
        {mostrarCp && (
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <Input
              value={codigoPostal}
              onChange={(e) => setCodigoPostal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarPorCp()}
              placeholder="Código postal (ej: 41001)"
              className="w-48"
              maxLength={5}
            />
            <Button size="sm" onClick={buscarPorCp}>Buscar cerca</Button>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtros:</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="buscar-precio" className="text-sm text-gray-600 whitespace-nowrap">Precio máx (€/h):</label>
            <Input
              id="buscar-precio"
              value={precioMax}
              onChange={(e) => setPrecioMax(e.target.value)}
              placeholder="ej: 50"
              className="w-24"
              type="number"
              min="0"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="buscar-valoracion" className="text-sm text-gray-600 whitespace-nowrap">Valoración mín:</label>
            <select
              id="buscar-valoracion"
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
          <button
            type="button"
            onClick={() => setSoloUrgencias(v => !v)}
            className={`flex items-center gap-2 h-10 px-4 rounded-md border text-sm font-medium transition-colors ${
              soloUrgencias
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Zap className="h-4 w-4" />
            Urgencias 24h
          </button>
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
          <Button variant="outline" onClick={() => { setProfesion(""); setPrecioMax(""); setValoracionMin(""); setSoloUrgencias(false); buscar() }} className="gap-2">
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
