// =================================================================
// CAPA: Domain / Entities
// Entidad pura "Fecha Bloqueada".
//
// Representa un día específico en que una especialidad NO atiende
// (por licencia médica, mantenimiento, feriado, etc.).
// La crea el administrador y bloquea reservas para esa fecha.
// =================================================================
export class FechaBloqueada {
    constructor(
        public id_bloqueo: number,
        public fecha: Date,
        public id_especialidad: number | null,
        public motivo: string | null,
        public creado_por: number,
        public fecha_registro: Date,
    ) {}
}