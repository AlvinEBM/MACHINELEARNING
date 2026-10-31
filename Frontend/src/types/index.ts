// =================================================================
// Tipos TypeScript globales del frontend
// =================================================================

export type Rol = 'PACIENTE' | 'ADMISION' | 'ADMIN' | 'MEDICO' | 'ENFERMERIA';

// ----- Auth -----
export interface JwtPayload {
    id: number;
    rol: Rol;
    iat?: number;
    exp?: number;
}

export interface LoginResponse {
    token: string;
    id_usuario: number;
    correo: string;
    nombres: string;
    apellidos: string;
    rol: Rol;
}

export interface Usuario {
    id_usuario: number;
    correo: string;
    nombres: string;
    apellidos: string;
    rol: Rol;
    dni?: string;
    telefono?: string;
}

// ----- Citas -----
export type EstadoCita = 'RESERVADA' | 'CONFIRMADA' | 'RECORDATORIO' | 'COMPLETADA' | 'FALTA' | 'CANCELADA';

export interface Especialidad {
    id_especialidad: number;
    nombre: string;
    descripcion?: string;
    estado?: 'ACTIVA' | 'INACTIVA';
}

export interface Horario {
    hora: string;              // "08:00:00"
    id_medico: number;
    medico_nombres: string;
    medico_apellidos: string;
    disponible: boolean;
}

export interface DiaCalendario {
    fecha: string;             // "2026-06-16"
    total: number;
    libres: number;
    reservable: boolean;
}

export interface Cita {
    id_cita: number;
    id_usuario: number;
    id_horario: number;
    id_dependiente: number | null;
    motivo: string | null;
    notas: string | null;
    estado: EstadoCita;
    fecha_registro: string;
}

export interface CitaConDetalles extends Cita {
    fecha?: string;
    hora?: string;
    especialidad?: string;
    medico_nombres?: string;
    medico_apellidos?: string;
}

export interface ContadoresPaciente {
    total: number;
    completadas: number;
    proximas: number;
    canceladas: number;
    faltas: number;
}

// ----- Notificaciones -----
export type TipoNotificacion = 'CANCELACION' | 'RECORDATORIO';

export interface Notificacion {
    id_notificacion: number;
    id_cita: number | null;
    id_usuario: number;
    tipo: TipoNotificacion;
    mensaje: string;
    enviado: boolean;
    leida: boolean;
    fecha_programada: string;
}

// ----- Respuestas API -----
export interface ApiResponse<T = unknown> {
    ok: boolean;
    mensaje?: string;
    [key: string]: T | unknown;
}
// ----- Documentos médicos y agente de IA -----
export type TipoDocumento = 'historia_clinica' | 'resultado_laboratorio' | 'orden_medica';
export type DecisionAcceso = 'AUTORIZAR' | 'RECHAZAR' | 'REQUIERE_APROBACION';
export type NivelAlerta = 'NORMAL' | 'ADVERTENCIA' | 'CRITICO' | 'NO_DISPONIBLE';

export interface DocumentoListado {
    id_documento: number;
    tipo_documento: TipoDocumento;
    titulo: string;
    fecha_creacion: string;
    id_paciente: number;
    paciente: string;
    dni_paciente: string | null;
    dependiente: string | null;
    medico_tratante: string;
}

export interface EvaluacionAgente {
    decision_arbol: DecisionAcceso | null;
    score_anomalia: number | null;
    nivel_alerta: NivelAlerta;
    prob_legitimidad: number | null;
    ruta_arbol: string[];
    tiempo_respuesta_ms: number | null;
    id_log: number | null;
}

export interface ResultadoAcceso {
    ok: boolean;
    decision: DecisionAcceso;
    explicacion: string;
    contexto: {
        relacion_paciente: 'medico_tratante' | 'personal_apoyo' | 'sin_relacion';
        autorizacion_excepcional: boolean;
        autorizacion_expira: string | null;
    };
    evaluacion: EvaluacionAgente;
    documento: {
        id_documento: number;
        tipo_documento: TipoDocumento;
        titulo: string;
        fecha_creacion: string;
        contenido?: string;
    };
    solicitud_pendiente: number | null;
    puede_solicitar_excepcional: boolean;
}

export interface RespuestaChat extends Partial<ResultadoAcceso> {
    tipo: 'aclaracion' | 'sin_resultados' | 'opciones' | 'decision';
    respuesta?: string;
    opciones?: DocumentoListado[];
    documento_listado?: DocumentoListado;
    interpretacion: {
        tipo_documento: TipoDocumento | null;
        paciente: string | null;
        justificacion: string | null;
    };
}

export interface SolicitudExcepcional {
    id_solicitud: number;
    id_documento: number;
    motivo: string;
    estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
    fecha_solicitud: string;
    fecha_respuesta: string | null;
    fecha_expiracion: string | null;
    solicitante: string;
    rol_solicitante: Rol;
    documento: string;
    tipo_documento: TipoDocumento;
    paciente: string;
}

export interface RegistroAuditoria {
    id_log: number;
    id_usuario: number;
    rol: string;
    id_documento: number | null;
    tipo_documento: TipoDocumento;
    relacion_paciente: string;
    hora_acceso: string;
    frecuencia_accesos: number;
    autorizacion_excepcional: boolean;
    decision: DecisionAcceso;
    decision_arbol: DecisionAcceso;
    score_anomalia: number;
    nivel_alerta: NivelAlerta;
    prob_legitimidad: number | null;
    explicacion: string;
    tiempo_respuesta_ms: number;
    fecha: string;
}

export interface AlertaAnomalia {
    id_alerta: number;
    id_log: number;
    id_usuario: number;
    score_anomalia: number;
    nivel: NivelAlerta;
    descripcion: string;
    revisada: boolean;
    fecha: string;
}

export interface EstadisticasAgente {
    total_solicitudes: number;
    ultimas_24h: number;
    por_decision: Partial<Record<DecisionAcceso, number>>;
    por_rol: Record<string, number>;
    por_nivel_alerta: Partial<Record<NivelAlerta, number>>;
    alertas_pendientes: number;
    tiempo_respuesta_promedio_ms: number;
    tiempo_respuesta_maximo_ms: number;
}
