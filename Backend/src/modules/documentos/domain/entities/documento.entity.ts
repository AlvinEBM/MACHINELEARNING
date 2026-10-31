// =================================================================
// CAPA: Domain / Entities
// Entidad pura "Documento médico" del dominio.
// =================================================================
export type TipoDocumento = 'historia_clinica' | 'resultado_laboratorio' | 'orden_medica';

export class Documento {
    constructor(
        public id_documento: number,
        public id_paciente: number,
        public id_dependiente: number | null,
        public tipo_documento: TipoDocumento,
        public titulo: string,
        public contenido: string,
        public id_medico_tratante: number,
        public fecha_creacion: Date,
    ) {}

    /** Datos que se pueden mostrar sin autorización (nunca incluye el contenido clínico) */
    resumen() {
        return {
            id_documento: this.id_documento,
            id_paciente: this.id_paciente,
            id_dependiente: this.id_dependiente,
            tipo_documento: this.tipo_documento,
            titulo: this.titulo,
            fecha_creacion: this.fecha_creacion,
        };
    }
}
