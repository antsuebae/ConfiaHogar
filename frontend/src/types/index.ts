export type RolUsuario = "cliente" | "profesional" | "admin"

export interface Usuario {
  id: number
  email: string
  nombre: string
  apellidos?: string
  telefono?: string
  rol: RolUsuario
  foto_perfil_url?: string
  descripcion?: string
  estado: "activa" | "pausada" | "baneada" | "eliminada"
  saldo: number
  creado_en: string
}

export interface ProfesionalCard {
  id: number
  usuario_id: number
  nombre: string
  profesion: string
  foto_perfil_url?: string
  valoracion_media: number
  total_resenas: number
  tarifa_hora?: number
  tarifa_visita?: number
  ciudad?: string
  verificado: boolean
  disponible: boolean
  distancia_km?: number
}

export interface ProfesionalDetalle extends ProfesionalCard {
  descripcion_profesional?: string
  codigo_postal?: string
  latitud?: number
  longitud?: number
  radio_servicio_km: number
  perfil_visible: boolean
  saldo_pendiente: number
  total_servicios: number
  cuenta_verificada: boolean
  verificacion_pendiente: boolean
  certificaciones: Certificacion[]
  creado_en: string
}

export interface Certificacion {
  id: number
  nombre: string
  documento_url?: string
  estado: "en_revision" | "aprobada" | "rechazada" | "caducada"
  motivo_rechazo?: string
  creado_en: string
}

export interface Cita {
  id: number
  cliente_id: number
  profesional_id: number
  titulo?: string
  descripcion?: string
  fecha_inicio: string
  fecha_fin?: string
  ubicacion?: string
  estado: "pendiente" | "confirmada" | "en_curso" | "completada" | "cancelada_cliente" | "cancelada_profesional"
  motivo_cancelacion?: string
  cancelacion_tardia: boolean
  recordatorio_minutos?: number
  fecha_propuesta?: string
  creado_en: string
  nombre_profesional?: string
  foto_profesional?: string
  nombre_cliente?: string
}

export interface FranjaDisponible {
  id: number
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export interface Mensaje {
  id: number
  conversacion_id: number
  remitente_id: number
  tipo: "texto" | "imagen" | "presupuesto" | "sistema"
  contenido?: string
  imagen_url?: string
  leido: boolean
  creado_en: string
  nombre_remitente?: string
  foto_remitente?: string
}

export interface Conversacion {
  id: number
  cliente_id: number
  profesional_id: number
  creado_en: string
  actualizado_en: string
  nombre_cliente?: string
  nombre_profesional?: string
  foto_cliente?: string
  foto_profesional?: string
  ultimo_mensaje?: string
  no_leidos: number
}

export interface Presupuesto {
  id: number
  conversacion_id: number
  remitente_id: number
  importe: number
  concepto?: string
  estado: "borrador" | "enviado" | "aceptado" | "rechazado" | "pagado" | "cancelado"
  presupuesto_padre_id?: number
  creado_en: string
}

export interface Resena {
  id: number
  cliente_id: number
  profesional_id: number
  cita_id?: number
  estrellas: number
  comentario?: string
  imagen_url?: string
  oculta: boolean
  respuesta_profesional?: string
  fecha_respuesta?: string
  creado_en: string
  nombre_cliente?: string
  foto_cliente?: string
}

export interface Transaccion {
  id: number
  cita_id: number
  cliente_id: number
  profesional_id: number
  importe: number
  comision: number
  importe_neto: number
  metodo: "google_pay" | "efectivo"
  estado: "pendiente" | "pendiente_validacion" | "completada" | "congelada" | "discrepancia" | "reembolsada"
  referencia_externa?: string
  creado_en: string
}

export type TipoNotificacion =
  | "mensaje_nuevo"
  | "cita_cancelada"
  | "cita_confirmada"
  | "presupuesto_recibido"
  | "pago_recibido"
  | "resena_recibida"
  | "recordatorio_cita"
  | "cuenta_verificada"
  | "discrepancia_pago"

export interface Notificacion {
  id: number
  usuario_id: number
  tipo: TipoNotificacion
  titulo: string
  cuerpo?: string
  leida: boolean
  url_destino?: string
  creado_en: string
}
