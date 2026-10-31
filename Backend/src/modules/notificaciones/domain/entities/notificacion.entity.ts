// =================================================================
// CAPA: Domain / Entities
// Entidad pura "Notificación" del dominio.
// =================================================================
export class Notificacion {
    constructor(
        public id_notificacion: number,
        public id_cita: number | null,
        public id_usuario: number,
        public tipo: 'CANCELACION' | 'RECORDATORIO',
        public mensaje: string,
        public enviado: boolean,
        public leida: boolean,
        public fecha_programada: Date,
    ) {}
}