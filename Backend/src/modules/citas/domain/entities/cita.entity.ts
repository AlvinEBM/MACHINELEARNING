// =================================================================
// CAPA: Domain / Entities
// Entidad PURA del dominio "Cita".
// Representa la reserva de un paciente sobre un horario específico.
//
// Estados posibles (línea de tiempo del proyecto):
//   RESERVADA    -> recién creada
//   CONFIRMADA   -> confirmada por el sistema/admisión
//   RECORDATORIO -> notificación enviada 24h antes
//   COMPLETADA   -> el paciente asistió y terminó la consulta
//   CANCELADA    -> cancelada por el paciente o por admin
//   FALTA        -> el paciente no asistió
// =================================================================
export class Cita {
    constructor(
        public id_cita: number,
        public id_usuario: number,        // paciente (FK -> usuarios)
        public id_horario: number,        // FK -> horarios
        public id_dependiente: number | null,
        public motivo: string | null,
        public notas: string | null,
        public estado:
            | 'RESERVADA'
            | 'CONFIRMADA'
            | 'RECORDATORIO'
            | 'COMPLETADA'
            | 'CANCELADA'
            | 'FALTA',
        public fecha_registro: Date,
    ) {}
}