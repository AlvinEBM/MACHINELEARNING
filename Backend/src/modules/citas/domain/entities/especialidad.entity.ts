// =================================================================
// CAPA: Domain / Entities
// Entidad PURA del dominio "Especialidad".
// Representa una especialidad médica del centro (Medicina General,
// Pediatría, Obstetricia, etc.).
// No conoce TypeORM ni HTTP.
// =================================================================
export class Especialidad {
    constructor(
        public id_especialidad: number,
        public nombre: string,
        public descripcion: string | null,
        public estado: 'ACTIVA' | 'INACTIVA',
    ) {}
}