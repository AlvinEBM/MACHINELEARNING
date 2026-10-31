// =================================================================
// CAPA: Domain / Entities
// Solicitud de autorización excepcional para acceder a un documento.
// Una solicitud APROBADA concede acceso temporal (24 horas).
// =================================================================
export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export class SolicitudAcceso {
    static readonly HORAS_VIGENCIA = 24;

    constructor(
        public id_solicitud: number,
        public id_usuario: number,
        public id_documento: number,
        public motivo: string,
        public estado: EstadoSolicitud,
        public id_aprobador: number | null,
        public fecha_solicitud: Date,
        public fecha_respuesta: Date | null,
        public fecha_expiracion: Date | null,
    ) {}

    estaVigente(ahora: Date = new Date()): boolean {
        return this.estado === 'APROBADA' && !!this.fecha_expiracion && this.fecha_expiracion > ahora;
    }
}
