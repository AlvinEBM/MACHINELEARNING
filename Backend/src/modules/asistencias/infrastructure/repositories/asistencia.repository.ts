// =================================================================
// CAPA: Infrastructure / Repositories
// Implementación CONCRETA de IAsistenciaRepository.
//
// ╔═══════════════════════════════════════════════════════════════╗
// ║  PATRÓN APLICADO: Repository + Data Mapper                    ║
// ║                                                                ║
// ║  El Repository es el ÚNICO lugar de la aplicación que conoce  ║
// ║  los Models de TypeORM. Internamente usa los Models para las  ║
// ║  queries, pero SIEMPRE devuelve entidades del Domain (Cita,   ║
// ║  User, Configuracion) gracias a los Mappings.                 ║
// ║                                                                ║
// ║  De esta forma, el Service trabaja únicamente con entidades   ║
// ║  del dominio, cumpliendo Clean Architecture.                  ║
// ╚═══════════════════════════════════════════════════════════════╝
// =================================================================
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../../config/datasource';

import {
    IAsistenciaRepository,
    CitaDelDia,
} from '../../domain/repositories/IAsistenciaRepository';

// ----- ENTIDADES del Domain (lo que devolvemos al Service) -----
import { Cita } from '../../../citas/domain/entities/cita.entity';
import { Configuracion } from '../../../administracion/domain/entities/configuracion.entity';

// ----- MODELS de TypeORM (uso INTERNO únicamente) -----
import { CitaModel } from '../../../citas/infrastructure/models/cita.model';
import { UserModel } from '../../../usuarios/infrastructure/models/user.model';
import { ConfiguracionModel } from '../../../administracion/infrastructure/models/configuracion.model';

// ----- MAPPINGS (traducen Model ⇄ Entity) -----
import { CitaMapping } from '../../../citas/infrastructure/mapping/cita.mapping';
import { ConfiguracionMapping } from '../../../administracion/infrastructure/mapping/configuracion.mapping';


export class AsistenciaRepository implements IAsistenciaRepository {
    // Los repos de TypeORM trabajan con Models (necesario por decoradores)
    private citaRepo: Repository<CitaModel>;
    private userRepo: Repository<UserModel>;
    private configRepo: Repository<ConfiguracionModel>;

    constructor() {
        this.citaRepo   = AppDataSource.getRepository(CitaModel);
        this.userRepo   = AppDataSource.getRepository(UserModel);
        this.configRepo = AppDataSource.getRepository(ConfiguracionModel);
    }

// ============================================================
    // Lista las citas de un día con datos enriquecidos.
    // Devuelve CitaDelDia[] donde cada item contiene una Cita
    // (entidad pura) + datos de paciente, médico, especialidad.
    // ============================================================
    async listarCitasDelDia(fecha: string): Promise<CitaDelDia[]> {
        const rows = await this.citaRepo
            .createQueryBuilder('c')
            .innerJoin('horarios',       'h', 'h.id_horario = c.id_horario')
            .innerJoin('medicos',        'm', 'm.id_medico = h.id_medico')
            .innerJoin('especialidades', 'e', 'e.id_especialidad = m.id_especialidad')
            .innerJoin('usuarios',       'p', 'p.id_usuario = c.id_usuario')
            .select([
                // Campos de la cita (para construir la Entity Cita)
                'c.id_cita         AS id_cita',
                'c.id_usuario      AS id_usuario',
                'c.id_horario      AS id_horario',
                'c.id_dependiente  AS id_dependiente',
                'c.motivo          AS motivo',
                'c.notas           AS notas',
                'c.estado          AS estado',
                'c.fecha_registro  AS fecha_registro',
                // Campos enriquecidos (joins)
                'h.fecha           AS fecha',
                'h.hora            AS hora',
                'p.nombres         AS paciente_nombres',
                'p.apellidos       AS paciente_apellidos',
                'p.dni             AS paciente_dni',
                'm.id_medico       AS id_medico',
                'm.nombres         AS medico_nombres',
                'm.apellidos       AS medico_apellidos',
                'e.nombre          AS especialidad',
            ])
            .where('h.fecha = :fecha', { fecha })
            .orderBy('h.hora', 'ASC')
            .getRawMany();

        // Mapeo: por cada fila construimos una Entity Cita + datos enriquecidos
        return rows.map(r => {
            const cita = new Cita(
                Number(r.id_cita),
                Number(r.id_usuario),
                Number(r.id_horario),
                r.id_dependiente ? Number(r.id_dependiente) : null,
                r.motivo,
                r.notas,
                r.estado,
                r.fecha_registro,
            );

            return {
                cita,                                          // ← entidad pura
                paciente_nombres: r.paciente_nombres,
                paciente_apellidos: r.paciente_apellidos,
                paciente_dni: r.paciente_dni,
                fecha: r.fecha,
                hora: r.hora,
                id_medico: Number(r.id_medico),
                medico_nombres: r.medico_nombres ?? '',
                medico_apellidos: r.medico_apellidos ?? '',
                especialidad: r.especialidad,
            };
        });
    }

    // ============================================================
    // Obtiene una cita por ID y la devuelve como entidad del dominio.
    // El Service nunca ve CitaModel, solo Cita.
    // ============================================================
    async obtenerCita(idCita: number): Promise<Cita | null> {
        const model = await this.citaRepo.findOne({
            where: { id_cita: idCita },
        });

        if (!model) return null;

        // Mapping: convierte Model → Entity
        return CitaMapping.toDomain(model);
    }

    // ============================================================
    async cambiarEstadoCita(idCita: number, nuevoEstado: string): Promise<void> {
        await this.citaRepo.update(
            { id_cita: idCita },
            { estado: nuevoEstado as any },
        );
    }

    // ============================================================
    async incrementarInasistencias(idUsuario: number): Promise<number> {
        await this.userRepo
            .createQueryBuilder()
            .update(UserModel)
            .set({ inasistencias: () => 'inasistencias + 1' })
            .where('id_usuario = :id', { id: idUsuario })
            .execute();

        const row = await this.userRepo
            .createQueryBuilder('u')
            .select('u.inasistencias', 'inasistencias')
            .where('u.id_usuario = :id', { id: idUsuario })
            .getRawOne();

        return row ? Number(row.inasistencias) : 0;
    }

    // ============================================================
    async bloquearCuenta(idUsuario: number): Promise<void> {
        await this.userRepo.update(
            { id_usuario: idUsuario },
            { cuenta_bloqueada: true },
        );
    }

    // ============================================================
    // Devuelve la entidad Configuracion (no el Model)
    // ============================================================
    async obtenerConfiguracion(clave: string): Promise<Configuracion | null> {
        const model = await this.configRepo.findOne({ where: { clave } });

        if (!model) return null;

        // Mapping: Model → Entity
        return ConfiguracionMapping.toDomain(model);
    }
}