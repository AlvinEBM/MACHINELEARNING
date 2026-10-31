// =================================================================
// CAPA: Infrastructure / Repositories
// Implementación CONCRETA de IAdminRepository usando TypeORM.
// Aquí ocurren las queries reales contra MySQL.
//
// PATRONES APLICADOS:
//   - Abstract Factory (UsuarioFactory.crearAdmision) para
//     construir el usuario antes de mapearlo al Model de TypeORM.
//     Esto garantiza que el rol ADMISION y los campos por defecto
//     (inasistencias=0, activo=true, etc.) sean consistentes.
//
// Reutiliza models de otros módulos: CitaModel, EspecialidadModel,
// UserModel.
// =================================================================
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../../config/datasource';

import { IAdminRepository } from '../../domain/repositories/IAdminRepository';
import { Configuracion } from '../../domain/entities/configuracion.entity';

import { FechaBloqueadaModel } from '../models/fecha-bloqueada.model';
import { ConfiguracionModel } from '../models/configuracion.model';
import { ConfiguracionMapping } from '../mapping/configuracion.mapping';

// Reutilizamos los models de otros módulos
import { CitaModel } from '../../../citas/infrastructure/models/cita.model';
import { EspecialidadModel } from '../../../citas/infrastructure/models/especialidad.model';
import { UserModel } from '../../../usuarios/infrastructure/models/user.model';

//  Patrón Abstract Factory aplicado también aquí
import { UsuarioFactory } from '../../../usuarios/domain/factories/usuario.factory';

export class AdminRepository implements IAdminRepository {
    private fechaBloqueadaRepo: Repository<FechaBloqueadaModel>;
    private configuracionRepo: Repository<ConfiguracionModel>;
    private citaRepo: Repository<CitaModel>;
    private especialidadRepo: Repository<EspecialidadModel>;
    private userRepo: Repository<UserModel>;

    constructor() {
        this.fechaBloqueadaRepo = AppDataSource.getRepository(FechaBloqueadaModel);
        this.configuracionRepo  = AppDataSource.getRepository(ConfiguracionModel);
        this.citaRepo           = AppDataSource.getRepository(CitaModel);
        this.especialidadRepo   = AppDataSource.getRepository(EspecialidadModel);
        this.userRepo           = AppDataSource.getRepository(UserModel);
    }

    // =============================================================
    // 1) CANCELACIÓN MASIVA
    // =============================================================
    async cancelarCitasPorFechaEspecialidad(
        fecha: string,
        idEspecialidad: number,
        _motivo: string,
    ): Promise<{ afectadas: number; idsUsuariosAfectados: number[] }> {
        const citas = await this.citaRepo
            .createQueryBuilder('c')
            .innerJoin('horarios', 'h',  'h.id_horario = c.id_horario')
            .innerJoin('medicos',  'm',  'm.id_medico = h.id_medico')
            .select(['c.id_cita AS id_cita', 'c.id_usuario AS id_usuario'])
            .where('h.fecha = :fecha', { fecha })
            .andWhere('m.id_especialidad = :idEsp', { idEsp: idEspecialidad })
            .andWhere("c.estado NOT IN ('CANCELADA','COMPLETADA','FALTA')")
            .getRawMany();

        if (citas.length === 0) {
            return { afectadas: 0, idsUsuariosAfectados: [] };
        }

        const idsCitas    = citas.map(c => c.id_cita);
        const idsUsuarios = citas.map(c => c.id_usuario);

        await this.citaRepo
            .createQueryBuilder()
            .update(CitaModel)
            .set({ estado: 'CANCELADA' })
            .whereInIds(idsCitas)
            .execute();

        return {
            afectadas: idsCitas.length,
            idsUsuariosAfectados: idsUsuarios,
        };
    }

    async insertarNotificacionesMasivas(
        idsUsuarios: number[],
        idCita: number | null,
        mensaje: string,
    ): Promise<void> {
        if (idsUsuarios.length === 0) return;

        const values = idsUsuarios.map(idUsuario => ({
            id_cita: idCita,
            id_usuario: idUsuario,
            tipo: 'CANCELACION',
            mensaje,
            enviado: false,
            fecha_programada: new Date(),
        }));

        await AppDataSource
            .createQueryBuilder()
            .insert()
            .into('notificaciones')
            .values(values)
            .execute();
    }

    async registrarFechaBloqueada(
        fecha: string,
        idEspecialidad: number,
        motivo: string,
        creadoPor: number,
    ): Promise<void> {
        const registro = this.fechaBloqueadaRepo.create({
            fecha: new Date(fecha),
            id_especialidad: idEspecialidad,
            motivo,
            creado_por: creadoPor,
        });
        await this.fechaBloqueadaRepo.save(registro);
    }

    // =============================================================
    // 2) GESTIÓN DE ESPECIALIDADES
    // =============================================================
    async existeEspecialidadPorNombre(nombre: string): Promise<boolean> {
        const count = await this.especialidadRepo.count({
            where: { nombre },
        });
        return count > 0;
    }

    async crearEspecialidad(
        nombre: string,
        descripcion: string,
    ): Promise<{ id: number }> {
        const nueva = this.especialidadRepo.create({
            nombre,
            descripcion,
            estado: 'ACTIVA',
        });
        const guardada = await this.especialidadRepo.save(nueva);
        return { id: guardada.id_especialidad };
    }

    async inhabilitarEspecialidad(
        idEspecialidad: number,
        desde: string,
        hasta: string,
        motivo: string,
        creadoPor: number,
    ): Promise<void> {
        await this.especialidadRepo.update(
            { id_especialidad: idEspecialidad },
            { estado: 'INACTIVA' },
        );

        const inicio = new Date(desde);
        const fin    = new Date(hasta);
        const registros: Partial<FechaBloqueadaModel>[] = [];

        for (
            let d = new Date(inicio);
            d <= fin;
            d.setDate(d.getDate() + 1)
        ) {
            registros.push({
                fecha: new Date(d),
                id_especialidad: idEspecialidad,
                motivo,
                creado_por: creadoPor,
            });
        }

        if (registros.length > 0) {
            await this.fechaBloqueadaRepo.insert(registros);
        }
    }

    // =============================================================
    // 3) CONFIGURACIÓN DE SANCIONES
    // =============================================================
    async obtenerConfiguracion(clave: string): Promise<Configuracion | null> {
        const model = await this.configuracionRepo.findOne({ where: { clave } });
        if (!model) return null;
        return ConfiguracionMapping.toDomain(model);
    }

    async guardarConfiguracion(
        clave: string,
        valor: string,
        descripcion?: string,
    ): Promise<void> {
        const existente = await this.configuracionRepo.findOne({ where: { clave } });

        if (existente) {
            existente.valor = valor;
            if (descripcion) existente.descripcion = descripcion;
            await this.configuracionRepo.save(existente);
        } else {
            const nuevo = this.configuracionRepo.create({
                clave,
                valor,
                descripcion: descripcion ?? '',
            });
            await this.configuracionRepo.save(nuevo);
        }
    }

    // =============================================================
    // 4) USUARIOS DE ADMISIÓN
    //
    //  PATRÓN APLICADO: Abstract Factory (UsuarioFactory)
    //    En vez de construir el usuario manualmente con
    //    `userRepo.create({ ..., rol: 'ADMISION' })`,
    //    delegamos en el factory para garantizar consistencia
    //    en los campos por defecto.
    // =============================================================
    async correoOdniExiste(correo: string, dni: string): Promise<boolean> {
        const count = await this.userRepo
            .createQueryBuilder('u')
            .where('u.correo = :correo OR u.dni = :dni', { correo, dni })
            .getCount();
        return count > 0;
    }

    async crearUsuarioAdmision(data: {
        correo: string;
        contrasenaHash: string;
        dni: string;
        nombres: string;
        apellidos: string;
        telefono: string;
    }): Promise<{ id_usuario: number }> {
        //  Abstract Factory: el factory garantiza rol y campos por defecto.
        const entidad = UsuarioFactory.crearAdmision({
            correo: data.correo,
            contrasenaHash: data.contrasenaHash,
            dni: data.dni,
            nombres: data.nombres,
            apellidos: data.apellidos,
            telefono: data.telefono,
        });

        // Convertimos la Entity a Model y persistimos
        const modelo = this.userRepo.create({
            correo: entidad.correo,
            contrasena: entidad.contrasena,
            rol: entidad.rol,
            dni: entidad.dni,
            nombres: entidad.nombres,
            apellidos: entidad.apellidos,
            telefono: entidad.telefono,
            fecha_nacimiento: entidad.fecha_nacimiento,
            direccion: entidad.direccion,
            genero: entidad.genero,
            inasistencias: entidad.inasistencias,
            cuenta_bloqueada: entidad.cuenta_bloqueada,
            intentos_fallidos: entidad.intentos_fallidos,
            activo: entidad.activo,
            fecha_registro: entidad.fecha_registro,
        });

        const guardado = await this.userRepo.save(modelo);
        return { id_usuario: guardado.id_usuario };
    }
}