// =================================================================
// CAPA: Domain / Repositories
// CONTRATO de persistencia del módulo Asistencias.
//
// IMPORTANTE: Todas las operaciones devuelven ENTIDADES del dominio
// (Cita, User, Configuracion). NUNCA Models de TypeORM.
//
// Para la vista enriquecida del panel de admisión (con joins de
// paciente, médico y especialidad) usamos una "vista" del dominio
// llamada CitaDelDia, que NO es una entidad sino un DTO de salida.
// =================================================================
import { Cita } from '../../../citas/domain/entities/cita.entity';
import { User } from '../../../usuarios/domain/entities/user.entity';
import { Configuracion } from '../../../administracion/domain/entities/configuracion.entity';

/**
 * Vista enriquecida de una cita con datos de paciente, médico y
 * especialidad. Es un DTO de salida del Domain, NO una entidad
 * (no se persiste).
 */
export interface CitaDelDia {
    cita: Cita;                       // entidad pura del dominio
    paciente_nombres: string;
    paciente_apellidos: string;
    paciente_dni: string;
    fecha: string;
    hora: string;
    id_medico: number;
    medico_nombres: string;
    medico_apellidos: string;
    especialidad: string;
}

export interface IAsistenciaRepository {

    /** Lista citas de un día con datos enriquecidos */
    listarCitasDelDia(fecha: string): Promise<CitaDelDia[]>;

    /** Obtiene una cita por ID (entidad pura del dominio) */
    obtenerCita(idCita: number): Promise<Cita | null>;

    /** Cambia el estado de una cita */
    cambiarEstadoCita(idCita: number, nuevoEstado: string): Promise<void>;

    /** Incrementa el contador de inasistencias y devuelve el total */
    incrementarInasistencias(idUsuario: number): Promise<number>;

    /** Bloquea la cuenta del paciente */
    bloquearCuenta(idUsuario: number): Promise<void>;

    /** Obtiene un parámetro de configuración como entidad del dominio */
    obtenerConfiguracion(clave: string): Promise<Configuracion | null>;
}