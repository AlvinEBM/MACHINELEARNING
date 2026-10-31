// =================================================================
// CAPA: Domain / Entities
// Entidad pura "Configuración del Sistema".
//
// Representa los parámetros configurables por el administrador:
//   - límite de inasistencias antes de bloquear cuenta
//   - días de suspensión por inasistencias
//   - cualquier otro parámetro futuro (clave-valor)
// =================================================================
export class Configuracion {
    constructor(
        public id_config: number,
        public clave: string,
        public valor: string,
        public descripcion: string | null,
    ) {}
}