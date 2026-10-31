// =================================================================
// CAPA: Infrastructure / Repositories
// Implementación de INotificacionRepository con TypeORM.
// =================================================================
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../../config/datasource';

import { INotificacionRepository } from '../../domain/repositories/INotificacionRepository';
import { Notificacion } from '../../domain/entities/notificacion.entity';
import { NotificacionModel } from '../models/notificacion.model';
import { NotificacionMapping } from '../mapping/notificacion.mapping';

export class NotificacionRepository implements INotificacionRepository {
    private repo: Repository<NotificacionModel>;

    constructor() {
        this.repo = AppDataSource.getRepository(NotificacionModel);
    }

    async listarPorUsuario(idUsuario: number): Promise<Notificacion[]> {
        const models = await this.repo.find({
            where: { id_usuario: idUsuario },
            order: { fecha_programada: 'DESC' },
        });

        return models.map(m => NotificacionMapping.toDomain(m));
    }

    async marcarLeida(idNotificacion: number, idUsuario: number): Promise<boolean> {
        const result = await this.repo.update(
            { id_notificacion: idNotificacion, id_usuario: idUsuario },
            { leida: true },
        );
        return (result.affected ?? 0) > 0;
    }

    async contarNoLeidas(idUsuario: number): Promise<number> {
        return this.repo.count({
            where: { id_usuario: idUsuario, leida: false },
        });
    }
    // ============================================================
    // Busca citas que serán en ~24 horas (necesitan recordatorio)
    // ============================================================
    async obtenerCitasParaRecordatorio(): Promise<{
        id_cita: number;
        id_usuario: number;
        nombres: string;
        fecha: string;
        hora: string;
        especialidad: string;
    }[]> {
        // Ventana de búsqueda: citas entre 23h y 25h en el futuro
        const ahora = new Date();
        const en23h = new Date(ahora.getTime() + 23 * 60 * 60 * 1000);
        const en25h = new Date(ahora.getTime() + 25 * 60 * 60 * 1000);

        const rows = await AppDataSource
            .createQueryBuilder()
            .from('citas', 'c')
            .innerJoin('horarios',       'h', 'h.id_horario = c.id_horario')
            .innerJoin('medicos',        'm', 'm.id_medico = h.id_medico')
            .innerJoin('especialidades', 'e', 'e.id_especialidad = m.id_especialidad')
            .innerJoin('usuarios',       'u', 'u.id_usuario = c.id_usuario')
            .select([
                'c.id_cita     AS id_cita',
                'c.id_usuario  AS id_usuario',
                'u.nombres     AS nombres',
                'h.fecha       AS fecha',
                'h.hora        AS hora',
                'e.nombre      AS especialidad',
            ])
            .where('c.estado = :estado', { estado: 'RESERVADA' })
            .andWhere(
                "TIMESTAMP(h.fecha, h.hora) BETWEEN :desde AND :hasta",
                { desde: en23h, hasta: en25h },
            )
            .getRawMany();

        return rows.map(r => ({
            id_cita: Number(r.id_cita),
            id_usuario: Number(r.id_usuario),
            nombres: r.nombres,
            fecha: r.fecha,
            hora: r.hora,
            especialidad: r.especialidad,
        }));
    }

    // ============================================================
    // Verifica si ya existe un recordatorio para esta cita
    // ============================================================
    async yaExisteRecordatorio(idCita: number): Promise<boolean> {
        const count = await this.repo.count({
            where: { id_cita: idCita, tipo: 'RECORDATORIO' },
        });
        return count > 0;
    }

    // ============================================================
    // Crea una notificación de tipo RECORDATORIO
    // ============================================================
    async crearRecordatorio(idCita: number, idUsuario: number, mensaje: string): Promise<void> {
        const nueva = this.repo.create({
            id_cita: idCita,
            id_usuario: idUsuario,
            tipo: 'RECORDATORIO',
            mensaje,
            enviado: true,
            leida: false,
            fecha_programada: new Date(),
        });
        await this.repo.save(nueva);
    }
}