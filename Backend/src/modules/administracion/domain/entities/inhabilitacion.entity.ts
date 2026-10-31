// =================================================================
// CAPA: Domain / Entities
// Entidad pura "Inhabilitación Temporal".
//
// Representa el rango (desde - hasta) en el que una especialidad
// estará inactiva.
// =================================================================
export class Inhabilitacion {
    constructor(
        public id_especialidad: number,
        public desde: Date,
        public hasta: Date,
        public motivo: string,
        public creado_por: number,
    ) {}
}