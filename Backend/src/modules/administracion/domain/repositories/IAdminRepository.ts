// =================================================================
// CAPA: Domain / Repositories
// CONTRATO único de persistencia para el módulo Administración.
//
// Agrupa todas las operaciones que el AdminService necesita.
// La implementación concreta vive en Infrastructure/Repositories.
// =================================================================
import { Configuracion } from '../entities/configuracion.entity';

export interface IAdminRepository {
    // ============================================================
    // 1) CANCELACIÓN MASIVA
    // ============================================================
    cancelarCitasPorFechaEspecialidad(
        fecha: string,
        idEspecialidad: number,
        motivo: string,
    ): Promise<{ afectadas: number; idsUsuariosAfectados: number[] }>;

    insertarNotificacionesMasivas(
        idsUsuarios: number[],
        idCita: number | null,
        mensaje: string,
    ): Promise<void>;

    registrarFechaBloqueada(
        fecha: string,
        idEspecialidad: number,
        motivo: string,
        creadoPor: number,
    ): Promise<void>;

    // ============================================================
    // 2) GESTIÓN DE ESPECIALIDADES
    // ============================================================
    existeEspecialidadPorNombre(nombre: string): Promise<boolean>;

    crearEspecialidad(
        nombre: string,
        descripcion: string,
    ): Promise<{ id: number }>;

    inhabilitarEspecialidad(
        idEspecialidad: number,
        desde: string,
        hasta: string,
        motivo: string,
        creadoPor: number,
    ): Promise<void>;

    // ============================================================
    // 3) CONFIGURACIÓN DE SANCIONES
    // ============================================================
    obtenerConfiguracion(clave: string): Promise<Configuracion | null>;

    guardarConfiguracion(
        clave: string,
        valor: string,
        descripcion?: string,
    ): Promise<void>;

    // ============================================================
    // 4) GESTIÓN DE USUARIOS DE ADMISIÓN
    // ============================================================
    crearUsuarioAdmision(data: {
        correo: string;
        contrasenaHash: string;
        dni: string;
        nombres: string;
        apellidos: string;
        telefono: string;
    }): Promise<{ id_usuario: number }>;

    correoOdniExiste(correo: string, dni: string): Promise<boolean>;
}