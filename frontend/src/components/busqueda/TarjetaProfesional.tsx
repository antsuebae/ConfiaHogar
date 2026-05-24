"use client"
import Link from "next/link"
import { Star, MapPin, CheckCircle, Clock, Euro, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { ProfesionalCard } from "@/types"
import { getInitials, formatEuros } from "@/lib/utils"

interface Props {
  profesional: ProfesionalCard
}

export function TarjetaProfesional({ profesional }: Props) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(profesional.valoracion_media))

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex gap-4">
          <div className="relative flex-shrink-0">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profesional.foto_perfil_url} />
              <AvatarFallback className="text-lg">{getInitials(profesional.nombre)}</AvatarFallback>
            </Avatar>
            {profesional.verificado && (
              <CheckCircle className="absolute -bottom-1 -right-1 h-5 w-5 text-success fill-white" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 overflow-hidden">
                <h3 className="font-semibold text-gray-900 truncate">{profesional.nombre}</h3>
                <p className="text-sm text-primary-600 font-medium truncate">{profesional.profesion}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {profesional.disponible_urgencias && (
                  <Badge className="text-xs bg-red-600 hover:bg-red-600 gap-1">
                    <Zap className="h-3 w-3" />
                    Urgencias 24h
                  </Badge>
                )}
                {profesional.disponible ? (
                  <Badge variant="success" className="text-xs">Disponible</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">No disponible</Badge>
                )}
                {profesional.verificado && (
                  <Badge variant="default" className="text-xs">Verificado</Badge>
                )}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-1">
              {stars.map((filled, i) => (
                <Star key={i} className={`h-4 w-4 ${filled ? "text-accent-500 fill-accent-500" : "text-gray-300"}`} />
              ))}
              <span className="ml-1 text-sm text-gray-600">
                {profesional.valoracion_media > 0
                  ? `${profesional.valoracion_media.toFixed(1)} (${profesional.total_resenas})`
                  : "Nuevo profesional"}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
              {profesional.ciudad && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {profesional.ciudad}
                  {profesional.distancia_km !== undefined && (
                    <span className="text-primary-600 font-medium">({profesional.distancia_km} km)</span>
                  )}
                </span>
              )}
              {profesional.tarifa_hora && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatEuros(profesional.tarifa_hora)}/h
                </span>
              )}
              {profesional.tarifa_visita && (
                <span className="flex items-center gap-1">
                  <Euro className="h-3.5 w-3.5" />
                  Visita: {formatEuros(profesional.tarifa_visita)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/profesional/${profesional.id}`} className="flex-1">
            <Button variant="outline" className="w-full" size="sm">Ver perfil</Button>
          </Link>
          <Link href={`/chat/nuevo?profesional=${profesional.id}`} className="flex-1">
            <Button className="w-full" size="sm">Contactar</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
