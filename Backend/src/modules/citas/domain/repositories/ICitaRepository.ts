// =================================================================
// CAPA: Domain / Repositories
// CONTRATO del repositorio de Citas.
// =================================================================
import { Cita } from '../entities/cita.entity';

export interface ICitaRepository {
    save(cita: Cita): Promise<Cita>;

    findByUsuario(idUsuario: number): Promise<Cita[]>;

    /**
     * Citas del paciente CON datos enriquecidos (fecha, hora,
     * especialidad, médico) para mostrar en el dashboard y mis-citas.
     */
    findDetalladasByUsuario(idUsuario: number): Promise<any[]>;

    contadoresPorUsuario(idUsuario: number): Promise<{
        total: number;
        completadas: number;
        enCurso: number;
        inasistencias: number;
    }>;

    listarTodas(): Promise<any[]>;

    /**
     * Busca una cita por id (entidad pura).
     */
    findById(idCita: number): Promise<Cita | null>;

    /**
     * Cambia el estado de una cita y libera su horario.
     */
    cancelar(idCita: number): Promise<boolean>;
}