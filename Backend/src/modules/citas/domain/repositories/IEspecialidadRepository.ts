// =================================================================
// CAPA: Domain / Repositories
// CONTRATO del repositorio de Especialidades.
// El Service depende de esta interfaz, NO de la implementación.
// =================================================================
import { Especialidad } from '../entities/especialidad.entity';

export interface IEspecialidadRepository {
    /**
     * Lista todas las especialidades con estado 'ACTIVA'.
     * Se usa para llenar el dropdown del formulario de cita.
     */
    findActivas(): Promise<Especialidad[]>;

    /**
     * Busca una especialidad por su ID.
     */
    findById(id: number): Promise<Especialidad | null>;
}