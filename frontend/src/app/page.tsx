"use client"
import Link from "next/link"
import { Search, Shield, Star, Zap, MapPin, Wrench, Zap as Bolt, Droplets, PaintBucket, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"

const CATEGORIAS = [
  { icon: Droplets, label: "Fontanería", query: "Fontanero" },
  { icon: Bolt, label: "Electricidad", query: "Electricista" },
  { icon: Wrench, label: "Carpintería", query: "Carpintero" },
  { icon: PaintBucket, label: "Pintura", query: "Pintor" },
  { icon: Key, label: "Cerrajería", query: "Cerrajero" },
  { icon: Wrench, label: "Albañilería", query: "Albañil" },
]

export default function HomePage() {
  const { usuario } = useAuthStore()

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 to-primary-500 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Profesionales del hogar de confianza
          </h1>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Fontaneros, electricistas, carpinteros y más en tu zona. Verificados, con valoraciones reales y precios transparentes.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/buscar">
              <Button size="lg" variant="accent" className="gap-2 text-base">
                <Search className="h-5 w-5" /> Buscar profesional
              </Button>
            </Link>
            {!usuario && (
              <Link href="/registro?rol=profesional">
                <Button size="lg" variant="outline" className="gap-2 text-base border-white text-white hover:bg-white/10">
                  Soy profesional
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">¿Qué necesitas?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {CATEGORIAS.map(({ icon: Icon, label, query }) => (
              <Link key={label} href={`/buscar?profesion=${query}`}>
                <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-all cursor-pointer group">
                  <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                    <Icon className="h-6 w-6 text-primary-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 text-center">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">¿Por qué CONFIAHOGAR?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: "Profesionales verificados", desc: "Comprobamos la identidad y certificaciones de cada profesional antes de publicar su perfil." },
              { icon: Star, title: "Valoraciones reales", desc: "Solo clientes que han contratado el servicio pueden dejar reseña. Sin votos falsos." },
              { icon: Zap, title: "En menos de 5 minutos", desc: "Busca, contacta y acuerda condiciones directamente desde la app. Sin intermediarios." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="mx-auto h-14 w-14 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                  <Icon className="h-7 w-7 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!usuario && (
        <section className="py-16 px-4 bg-primary-600 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">¿Eres profesional?</h2>
          <p className="text-primary-100 mb-6">Únete a CONFIAHOGAR y consigue más clientes en tu zona</p>
          <Link href="/registro?rol=profesional">
            <Button size="lg" variant="accent">Crear perfil gratis</Button>
          </Link>
        </section>
      )}
    </div>
  )
}
