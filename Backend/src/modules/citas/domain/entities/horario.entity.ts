// =================================================================
// CAPA: Domain / Entities
// Entidad PURA del dominio "Horario".
// Representa un bloque de tiempo disponible de un médico
// (fecha + hora + tipo de visita).
//
// El paciente ve solo los horarios disponibles y reserva uno.
// =================================================================
export class Horario {
    constructor(
        public id_horario: number,
        public id_medico: number,
        public fecha: Date,
        public hora: string,                          // formato 'HH:MM:SS'
        public tipo_visita: 'PRESENCIAL' | 'VIRTUAL',
        public disponible: boolean,
    ) {}

    /**
     * Método PROTOTYPE.
     * Devuelve una COPIA independiente de este Horario.
     * El nuevo objeto comparte los mismos valores pero NO la misma
     * referencia en memoria. Modificarlo no afecta al original.
     *
     * Nota importante: la fecha se clona como un nuevo objeto Date
     * para evitar que ambos horarios compartan la misma referencia
     * (Date es un objeto mutable en JavaScript).
     */
    clone(): Horario {
        return new Horario(
            0,                          // el clon siempre nace con id 0 (lo asigna MySQL)
            this.id_medico,
            new Date(this.fecha),       // copia profunda del Date para evitar mutación
            this.hora,
            this.tipo_visita,
            this.disponible,
        );
    }
}