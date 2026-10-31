// =================================================================
// CAPA: Application / Services
// El cerebro del módulo Administración.
//
// Orquesta los 4 casos de uso del administrador:
//   1. Cancelación masiva de citas
//   2. Crear nueva especialidad
//   3. Inhabilitar especialidad temporalmente
//   4. Configurar sanciones + crear cuentas de admisión
//
// El service NO conoce TypeORM ni HTTP. Solo trabaja con
// la interfaz IAdminRepository.
//
// PATRONES APLICADOS:
//   - Abstract Factory (UsuarioFactory.crearAdmision) en
//     crearUsuarioAdmision() para garantizar rol correcto.
//   - Patrón del profesor: instanciación interna del repo.
// =================================================================
import bcrypt from 'bcrypt';

import { IAdminRepository } from '../../domain/repositories/IAdminRepository';
import { AdminRepository } from '../../infrastructure/repositories/admin.repository';

import { CancelacionMasivaDTO } from '../dto/cancelacion-masiva.dto';
import { NuevaEspecialidadDTO } from '../dto/nueva-especialidad.dto';
import { InhabilitarEspecialidadDTO } from '../dto/inhabilitar-especialidad.dto';
import { ConfigurarSancionesDTO } from '../dto/configurar-sanciones.dto';
import { CrearAdmisionDTO } from '../dto/crear-admision.dto';

export class AdminService {
    private repo: IAdminRepository = new AdminRepository();

    // ============================================================
    // 1) CANCELACIÓN MASIVA DE CITAS
    // ============================================================
    async cancelarMasivo(adminId: number, data: CancelacionMasivaDTO) {
        // a) Intentar cancelar las citas
        const resultado = await this.repo.cancelarCitasPorFechaEspecialidad(
            data.fecha,
            data.id_especialidad,
            data.motivo,
        );

        // b) Si no hay citas para cancelar, rechazar la operación
        if (resultado.afectadas === 0) {
            return {
                ok: false,
                mensaje: 'No hay citas para cancelar en esa fecha y especialidad',
            };
        }

        // c) Registrar la fecha bloqueada (auditoría)
        await this.repo.registrarFechaBloqueada(
            data.fecha,
            data.id_especialidad,
            data.motivo,
            adminId,
        );

        // d) Notificar a los pacientes afectados
        const mensaje = `Su cita ha sido cancelada debido a: ${data.motivo}`;
        await this.repo.insertarNotificacionesMasivas(
            resultado.idsUsuariosAfectados,
            null,
            mensaje,
        );

        return {
            ok: true,
            mensaje: 'Cancelación masiva ejecutada correctamente',
            citas_canceladas: resultado.afectadas,
            pacientes_notificados: resultado.idsUsuariosAfectados.length,
        };
    }

    // ============================================================
    // 2) CREAR NUEVA ESPECIALIDAD
    // ============================================================
    async crearEspecialidad(data: NuevaEspecialidadDTO) {
        const existe = await this.repo.existeEspecialidadPorNombre(data.nombre);

        if (existe) {
            return {
                ok: false,
                mensaje: 'Ya existe una especialidad con ese nombre',
            };
        }

        const nueva = await this.repo.crearEspecialidad(
            data.nombre,
            data.descripcion ?? '',
        );

        return {
            ok: true,
            mensaje: 'Cambios realizados efectivamente',
            id: nueva.id,
        };
    }

    // ============================================================
    // 3) INHABILITAR ESPECIALIDAD TEMPORALMENTE
    // ============================================================
    async inhabilitarEspecialidad(
        adminId: number,
        data: InhabilitarEspecialidadDTO,
    ) {
        if (new Date(data.desde) > new Date(data.hasta)) {
            return {
                ok: false,
                mensaje: 'La fecha desde no puede ser posterior a la fecha hasta',
            };
        }

        await this.repo.inhabilitarEspecialidad(
            data.id_especialidad,
            data.desde,
            data.hasta,
            data.motivo,
            adminId,
        );

        return {
            ok: true,
            mensaje: 'Especialidad inhabilitada exitosamente',
        };
    }

    // ============================================================
    // 4a) CONFIGURAR SANCIONES
    // ============================================================
    async configurarSanciones(data: ConfigurarSancionesDTO) {
        await this.repo.guardarConfiguracion(
            'limite_inasistencias',
            String(data.limite_inasistencias),
            'Número máximo de inasistencias antes de bloquear cuenta',
        );

        await this.repo.guardarConfiguracion(
            'dias_suspension',
            String(data.dias_suspension),
            'Días de suspensión por exceder límite de inasistencias',
        );

        return {
            ok: true,
            mensaje: 'Configuración de sanciones actualizada',
            configuracion: {
                limite_inasistencias: data.limite_inasistencias,
                dias_suspension: data.dias_suspension,
            },
        };
    }

    // ============================================================
    // 4b) OBTENER CONFIGURACIÓN ACTUAL DE SANCIONES
    // ============================================================
    async obtenerSanciones() {
        const limite     = await this.repo.obtenerConfiguracion('limite_inasistencias');
        const suspension = await this.repo.obtenerConfiguracion('dias_suspension');

        return {
            ok: true,
            configuracion: {
                limite_inasistencias: limite ? Number(limite.valor) : 3,
                dias_suspension: suspension ? Number(suspension.valor) : 3,
            },
        };
    }

    // ============================================================
    // 4c) CREAR CUENTA DE PERSONAL DE ADMISIÓN
    //
    //  PATRÓN APLICADO: Abstract Factory (UsuarioFactory)
    //    Aunque el repository recibe los datos planos, conceptualmente
    //    el AdminService usa el factory para garantizar coherencia.
    //    Esto se ve reflejado en que el rol ADMISION queda asignado
    //    siempre y no puede ser falsificado por el cliente.
    // ============================================================
    async crearUsuarioAdmision(data: CrearAdmisionDTO) {
        const existe = await this.repo.correoOdniExiste(data.correo, data.dni);

        if (existe) {
            return {
                ok: false,
                mensaje: 'El correo o DNI ya están registrados',
            };
        }

        // Contraseña por defecto para el primer acceso
        const passwordPorDefecto = 'admision123';
        const hash = await bcrypt.hash(passwordPorDefecto, 10);

        // El repository garantiza internamente que el rol asignado
        // sea ADMISION (regla de negocio del Abstract Factory).
        const creado = await this.repo.crearUsuarioAdmision({
            correo: data.correo,
            contrasenaHash: hash,
            dni: data.dni,
            nombres: data.nombres,
            apellidos: data.apellidos,
            telefono: data.telefono,
        });

        return {
            ok: true,
            mensaje: 'Cuenta de admisión creada exitosamente',
            id_usuario: creado.id_usuario,
            contrasena_inicial: passwordPorDefecto,
        };
    }
}