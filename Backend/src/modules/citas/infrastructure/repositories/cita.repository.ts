// =================================================================
// CAPA: Infrastructure / Repositories
// Implementación de ICitaRepository usando TypeORM.
// =================================================================
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../../config/datasource';
import { CitaModel } from '../models/cita.model';
import { HorarioModel } from '../models/horario.model';
import { ICitaRepository } from '../../domain/repositories/ICitaRepository';
import { Cita } from '../../domain/entities/cita.entity';
import { CitaMapping } from '../mapping/cita.mapping';

export class CitaRepository implements ICitaRepository {
    private repo: Repository<CitaModel>;
    private horarioRepo: Repository<HorarioModel>;

    constructor() {
        this.repo = AppDataSource.getRepository(CitaModel);
        this.horarioRepo = AppDataSource.getRepository(HorarioModel);
    }

    async save(cita: Cita): Promise<Cita> {
        const model = CitaMapping.toModel(cita);
        const saved = await this.repo.save(model);
        return CitaMapping.toDomain(saved);
    }

    async findByUsuario(idUsuario: number): Promise<Cita[]> {
        const models = await this.repo.find({
            where: { id_usuario: idUsuario },
            order: { fecha_registro: 'DESC' },
        });
        return models.map(m => CitaMapping.toDomain(m));
    }

    // ============================================================
    // NUEVO: Citas del paciente CON datos enriquecidos
    // ============================================================
    async findDetalladasByUsuario(idUsuario: number): Promise<any[]> {
        const rows = await this.repo
            .createQueryBuilder('c')
            .innerJoin('horarios',       'h', 'h.id_horario = c.id_horario')
            .innerJoin('medicos',        'm', 'm.id_medico = h.id_medico')
            .innerJoin('especialidades', 'e', 'e.id_especialidad = m.id_especialidad')
            .select([
                'c.id_cita        AS id_cita',
                'c.id_usuario     AS id_usuario',
                'c.id_horario     AS id_horario',
                'c.motivo         AS motivo',
                'c.notas          AS notas',
                'c.estado         AS estado',
                'c.fecha_registro AS fecha_registro',
                'h.fecha          AS fecha',
                'h.hora           AS hora',
                'm.id_medico      AS id_medico',
                'm.nombres        AS medico_nombres',
                'm.apellidos      AS medico_apellidos',
                'e.nombre         AS especialidad',
            ])
            .where('c.id_usuario = :idUsuario', { idUsuario })
            .orderBy('h.fecha', 'ASC')
            .addOrderBy('h.hora', 'ASC')
            .getRawMany();

        return rows.map(r => ({
            id_cita: Number(r.id_cita),
            id_usuario: Number(r.id_usuario),
            id_horario: Number(r.id_horario),
            motivo: r.motivo,
            notas: r.notas,
            estado: r.estado,
            fecha_registro: r.fecha_registro,
            // fecha como string YYYY-MM-DD (sin desfase de zona horaria)
            fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10),
            hora: r.hora,
            id_medico: Number(r.id_medico),
            medico_nombres: r.medico_nombres,
            medico_apellidos: r.medico_apellidos,
            especialidad: r.especialidad,
        }));
    }

    async contadoresPorUsuario(idUsuario: number) {
        const total        = await this.repo.count({ where: { id_usuario: idUsuario } });
        const completadas  = await this.repo.count({ where: { id_usuario: idUsuario, estado: 'COMPLETADA' } });
        const inasistencias = await this.repo.count({ where: { id_usuario: idUsuario, estado: 'FALTA' } });

        const enCursoReservada    = await this.repo.count({ where: { id_usuario: idUsuario, estado: 'RESERVADA' } });
        const enCursoConfirmada   = await this.repo.count({ where: { id_usuario: idUsuario, estado: 'CONFIRMADA' } });
        const enCursoRecordatorio = await this.repo.count({ where: { id_usuario: idUsuario, estado: 'RECORDATORIO' } });

        return {
            total,
            completadas,
            enCurso: enCursoReservada + enCursoConfirmada + enCursoRecordatorio,
            inasistencias,
        };
    }

    async listarTodas(): Promise<any[]> {
        const rows = await this.repo
            .createQueryBuilder('c')
            .innerJoin('horarios',       'h',   'h.id_horario = c.id_horario')
            .innerJoin('medicos',        'm',   'm.id_medico = h.id_medico')
            .innerJoin('especialidades', 'e',   'e.id_especialidad = m.id_especialidad')
            .innerJoin('usuarios',       'p',   'p.id_usuario = c.id_usuario')
            .select([
                'c.id_cita        AS id_cita',
                'c.estado         AS estado',
                'c.motivo         AS motivo',
                'c.fecha_registro AS fecha_registro',
                'h.fecha          AS fecha',
                'h.hora           AS hora',
                'p.id_usuario     AS id_usuario',
                'p.nombres        AS paciente_nombres',
                'p.apellidos      AS paciente_apellidos',
                'p.dni            AS paciente_dni',
                'e.nombre         AS especialidad',
            ])
            .orderBy('h.fecha', 'DESC')
            .addOrderBy('h.hora', 'ASC')
            .getRawMany();

        return rows.map(r => ({
            id_cita: Number(r.id_cita),
            estado: r.estado,
            motivo: r.motivo,
            fecha_registro: r.fecha_registro,
            fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10),
            hora: r.hora,
            id_usuario: Number(r.id_usuario),
            paciente_nombres: r.paciente_nombres,
            paciente_apellidos: r.paciente_apellidos,
            paciente_dni: r.paciente_dni,
            especialidad: r.especialidad,
        }));
    }

    // ============================================================
    // NUEVO: Buscar cita por ID
    // ============================================================
    async findById(idCita: number): Promise<Cita | null> {
        const model = await this.repo.findOne({ where: { id_cita: idCita } });
        if (!model) return null;
        return CitaMapping.toDomain(model);
    }

    // ============================================================
    // NUEVO: Cancelar cita + liberar horario
    // ============================================================
    async cancelar(idCita: number): Promise<boolean> {
        const cita = await this.repo.findOne({ where: { id_cita: idCita } });
        if (!cita) return false;

        // 1) Cambiar estado de la cita a CANCELADA
        await this.repo.update({ id_cita: idCita }, { estado: 'CANCELADA' as any });

        // 2) Liberar el horario (volver disponible)
        //    Con Enfoque A1, el horario existe en BD. Lo marcamos disponible.
        await this.horarioRepo.update(
            { id_horario: cita.id_horario },
            { disponible: true },
        );

        return true;
    }
}