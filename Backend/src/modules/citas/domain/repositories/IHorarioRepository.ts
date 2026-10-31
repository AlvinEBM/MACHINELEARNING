// =================================================================
// CAPA: Domain / Repositories
// Contrato del repositorio de horarios.
// =================================================================
import { Horario } from '../entities/horario.entity';

export interface IHorarioRepository {
    findDisponibles(fecha: string, idEspecialidad: number): Promise<Horario[]>;
    findById(id: number): Promise<Horario | null>;
    marcarNoDisponible(id: number): Promise<void>;

    // Nuevos (Enfoque A1)
    obtenerMedicoDeEspecialidad(idEspecialidad: number): Promise<{
        id_medico: number;
        nombres: string;
        apellidos: string;
        id_especialidad: number;
    } | null>;

    findByMedicoFechaHora(idMedico: number, fecha: string, hora: string): Promise<{
        id_horario: number;
        disponible: boolean;
    } | null>;

    crearHorario(idMedico: number, fecha: string, hora: string): Promise<number>;
}