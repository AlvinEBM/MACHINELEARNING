// =================================================================
// CAPA: Domain / Repositories
// Contrato de persistencia del módulo Notificaciones.
// =================================================================
import { Notificacion } from '../entities/notificacion.entity';

export interface INotificacionRepository {
    /** Lista todas las notificaciones de un usuario, recientes primero */
    listarPorUsuario(idUsuario: number): Promise<Notificacion[]>;

    /** Marca una notificación como leída */
    marcarLeida(idNotificacion: number, idUsuario: number): Promise<boolean>;

    /** Cuenta cuántas notificaciones no leídas tiene el usuario */
    contarNoLeidas(idUsuario: number): Promise<number>;
/** Busca citas que tendrán lugar en exactamente 24 horas y necesitan recordatorio */
    obtenerCitasParaRecordatorio(): Promise<{
        id_cita: number;
        id_usuario: number;
        nombres: string;
        fecha: string;
        hora: string;
        especialidad: string;
    }[]>;

    /** Verifica si ya existe un recordatorio para una cita (evita duplicados) */
    yaExisteRecordatorio(idCita: number): Promise<boolean>;

    /** Crea una notificación de tipo RECORDATORIO */
    crearRecordatorio(idCita: number, idUsuario: number, mensaje: string): Promise<void>;

}