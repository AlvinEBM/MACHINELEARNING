// =================================================================
// CAPA: Infrastructure / Repositories
// Implementación de IDocumentoRepository con TypeORM.
//
// Además de leer documentos, calcula el CONTEXTO que necesita el
// agente de IA: si el usuario es médico tratante, si atendió al
// paciente, si el paciente tiene atención en curso y si existe una
// autorización excepcional vigente.
// =================================================================
import { Brackets, Repository } from 'typeorm';

import { AppDataSource } from '../../../../config/datasource';
import { DocumentoModel } from '../models/documento.model';
import { AccessRequestModel } from '../models/access-request.model';
import { DocumentoMapping } from '../mapping/documento.mapping';
import { DocumentoListado, IDocumentoRepository } from '../../domain/repositories/IDocumentoRepository';
import { Documento, TipoDocumento } from '../../domain/entities/documento.entity';
import { EstadoSolicitud, SolicitudAcceso } from '../../domain/entities/solicitud-acceso.entity';

const ESTADOS_ATENCION = ['RESERVADA', 'CONFIRMADA', 'RECORDATORIO', 'COMPLETADA'];

export class DocumentoRepository implements IDocumentoRepository {
    private repo: Repository<DocumentoModel>;
    private solicitudes: Repository<AccessRequestModel>;

    constructor() {
        this.repo = AppDataSource.getRepository(DocumentoModel);
        this.solicitudes = AppDataSource.getRepository(AccessRequestModel);
    }

    // ------------------------------------------------------------
    // Consulta base: documento + paciente + dependiente + tratante
    // ------------------------------------------------------------
    private consultaListado() {
        return this.repo
            .createQueryBuilder('d')
            .innerJoin('usuarios', 'u', 'u.id_usuario = d.id_paciente')
            .leftJoin('dependientes', 'dep', 'dep.id_dependiente = d.id_dependiente')
            .innerJoin('medicos', 'm', 'm.id_medico = d.id_medico_tratante')
            .select([
                'd.id_documento   AS id_documento',
                'd.tipo_documento AS tipo_documento',
                'd.titulo         AS titulo',
                'd.fecha_creacion AS fecha_creacion',
                'd.id_paciente    AS id_paciente',
                "CONCAT(u.nombres, ' ', u.apellidos) AS paciente",
                'u.dni            AS dni_paciente',
                "CONCAT(dep.nombres, ' ', dep.apellidos) AS dependiente",
                'dep.dni          AS dni_dependiente',
                "CONCAT(m.nombres, ' ', m.apellidos) AS medico_tratante",
            ])
            .orderBy('d.id_documento', 'ASC');
    }

    private static aListado(r: any): DocumentoListado {
        return {
            id_documento: Number(r.id_documento),
            tipo_documento: r.tipo_documento,
            titulo: r.titulo,
            fecha_creacion: r.fecha_creacion,
            id_paciente: Number(r.id_paciente),
            paciente: r.paciente,
            dni_paciente: r.dni_paciente ?? null,
            dependiente: r.dependiente ?? null,
            dni_dependiente: r.dni_dependiente ?? null,
            medico_tratante: r.medico_tratante,
        };
    }

    async listar(): Promise<DocumentoListado[]> {
        const rows = await this.consultaListado().getRawMany();
        return rows.map(DocumentoRepository.aListado);
    }

    async buscarPorId(idDocumento: number): Promise<Documento | null> {
        const m = await this.repo.findOne({ where: { id_documento: idDocumento } });
        return m ? DocumentoMapping.toDomain(m) : null;
    }

    async buscarPorPaciente(texto: string, tipo?: TipoDocumento | null): Promise<DocumentoListado[]> {
        const q = this.consultaListado();
        const limpio = texto.trim();

        if (/^\d{8}$/.test(limpio)) {
            q.where(new Brackets(w => {
                w.where('u.dni = :dni', { dni: limpio }).orWhere('dep.dni = :dni', { dni: limpio });
            }));
        } else {
            // Cada palabra del nombre debe aparecer en el nombre del paciente o del dependiente
            const palabras = limpio.split(/\s+/).filter(p => p.length > 1).slice(0, 4);
            palabras.forEach((p, i) => {
                const param = { [`p${i}`]: `%${p}%` };
                const cond = new Brackets(w => {
                    w.where(`CONCAT(u.nombres, ' ', u.apellidos) LIKE :p${i}`, param)
                     .orWhere(`CONCAT(dep.nombres, ' ', dep.apellidos) LIKE :p${i}`, param);
                });
                i === 0 ? q.where(cond) : q.andWhere(cond);
            });
        }
        if (tipo) {
            q.andWhere('d.tipo_documento = :tipo', { tipo });
        }
        const rows = await q.getRawMany();
        return rows.map(DocumentoRepository.aListado);
    }

    async medicoPorUsuario(idUsuario: number): Promise<number | null> {
        const row = await AppDataSource.createQueryBuilder()
            .from('medicos', 'm')
            .select('m.id_medico', 'id_medico')
            .where('m.id_usuario = :idUsuario', { idUsuario })
            .getRawOne();
        return row ? Number(row.id_medico) : null;
    }

    async medicoAtendioPaciente(idMedico: number, idPaciente: number, idDependiente: number | null): Promise<boolean> {
        const q = AppDataSource.createQueryBuilder()
            .from('citas', 'c')
            .innerJoin('horarios', 'h', 'h.id_horario = c.id_horario')
            .where('h.id_medico = :idMedico', { idMedico })
            .andWhere('c.id_usuario = :idPaciente', { idPaciente })
            .andWhere('c.estado IN (:...estados)', { estados: ESTADOS_ATENCION });
        if (idDependiente) {
            q.andWhere('c.id_dependiente = :idDependiente', { idDependiente });
        } else {
            q.andWhere('c.id_dependiente IS NULL');
        }
        return (await q.getCount()) > 0;
    }

    async pacienteTieneCitaEnRango(idPaciente: number, diasAtras: number, diasAdelante: number): Promise<boolean> {
        const count = await AppDataSource.createQueryBuilder()
            .from('citas', 'c')
            .innerJoin('horarios', 'h', 'h.id_horario = c.id_horario')
            .where('c.id_usuario = :idPaciente', { idPaciente })
            .andWhere('c.estado IN (:...estados)', { estados: ESTADOS_ATENCION })
            .andWhere('h.fecha BETWEEN DATE_SUB(CURDATE(), INTERVAL :atras DAY) AND DATE_ADD(CURDATE(), INTERVAL :adelante DAY)',
                { atras: diasAtras, adelante: diasAdelante })
            .getCount();
        return count > 0;
    }

    // ------------------------------------------------------------
    // Solicitudes de autorización excepcional
    // ------------------------------------------------------------
    async autorizacionVigente(idUsuario: number, idDocumento: number): Promise<SolicitudAcceso | null> {
        const m = await this.solicitudes
            .createQueryBuilder('r')
            .where('r.id_usuario = :idUsuario AND r.id_documento = :idDocumento', { idUsuario, idDocumento })
            .andWhere("r.estado = 'APROBADA' AND r.fecha_expiracion > NOW()")
            .orderBy('r.fecha_expiracion', 'DESC')
            .getOne();
        return m ? DocumentoMapping.solicitudToDomain(m) : null;
    }

    async solicitudPendiente(idUsuario: number, idDocumento: number): Promise<SolicitudAcceso | null> {
        const m = await this.solicitudes.findOne({
            where: { id_usuario: idUsuario, id_documento: idDocumento, estado: 'PENDIENTE' },
        });
        return m ? DocumentoMapping.solicitudToDomain(m) : null;
    }

    async crearSolicitud(idUsuario: number, idDocumento: number, motivo: string): Promise<SolicitudAcceso> {
        const nueva = this.solicitudes.create({ id_usuario: idUsuario, id_documento: idDocumento, motivo, estado: 'PENDIENTE' });
        const guardada = await this.solicitudes.save(nueva);
        const recargada = await this.solicitudes.findOneByOrFail({ id_solicitud: guardada.id_solicitud });
        return DocumentoMapping.solicitudToDomain(recargada);
    }

    async listarSolicitudes(estado?: EstadoSolicitud, idUsuario?: number): Promise<any[]> {
        const q = this.solicitudes
            .createQueryBuilder('r')
            .innerJoin('usuarios', 'u', 'u.id_usuario = r.id_usuario')
            .innerJoin('documentos', 'd', 'd.id_documento = r.id_documento')
            .innerJoin('usuarios', 'p', 'p.id_usuario = d.id_paciente')
            .select([
                'r.id_solicitud     AS id_solicitud',
                'r.id_documento     AS id_documento',
                'r.motivo           AS motivo',
                'r.estado           AS estado',
                'r.fecha_solicitud  AS fecha_solicitud',
                'r.fecha_respuesta  AS fecha_respuesta',
                'r.fecha_expiracion AS fecha_expiracion',
                "CONCAT(u.nombres, ' ', u.apellidos) AS solicitante",
                'u.rol              AS rol_solicitante',
                'd.titulo           AS documento',
                'd.tipo_documento   AS tipo_documento',
                "CONCAT(p.nombres, ' ', p.apellidos) AS paciente",
            ])
            .orderBy('r.fecha_solicitud', 'DESC');
        if (estado) q.andWhere('r.estado = :estado', { estado });
        if (idUsuario) q.andWhere('r.id_usuario = :idUsuario', { idUsuario });
        const rows = await q.getRawMany();
        return rows.map(r => ({ ...r, id_solicitud: Number(r.id_solicitud), id_documento: Number(r.id_documento) }));
    }

    async buscarSolicitud(idSolicitud: number): Promise<SolicitudAcceso | null> {
        const m = await this.solicitudes.findOne({ where: { id_solicitud: idSolicitud } });
        return m ? DocumentoMapping.solicitudToDomain(m) : null;
    }

    async responderSolicitud(idSolicitud: number, idAprobador: number, aprobada: boolean, expiracion: Date | null): Promise<void> {
        await this.solicitudes.update(
            { id_solicitud: idSolicitud },
            {
                estado: aprobada ? 'APROBADA' : 'RECHAZADA',
                id_aprobador: idAprobador,
                fecha_respuesta: new Date(),
                fecha_expiracion: expiracion,
            },
        );
    }
}
