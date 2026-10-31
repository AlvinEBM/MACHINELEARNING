// =================================================================
// CAPA: Application / Services
// Lógica de negocio para gestión de asistencias.
//
// El Service trabaja ÚNICAMENTE con entidades del dominio (Cita,
// Configuracion). NUNCA conoce los Models de TypeORM.
// =================================================================
import { IAsistenciaRepository } from '../../domain/repositories/IAsistenciaRepository';
import { AsistenciaRepository } from '../../infrastructure/repositories/asistencia.repository';

export class AsistenciaService {
    private repo: IAsistenciaRepository = new AsistenciaRepository();

    // ============================================================
    // 1) LISTAR CITAS DE UN DÍA
    // ============================================================
    async listarCitasDelDia(fecha?: string) {
        const fechaConsulta = fecha ?? new Date().toISOString().slice(0, 10);

        const citas = await this.repo.listarCitasDelDia(fechaConsulta);

        return {
            ok: true,
            fecha: fechaConsulta,
            total: citas.length,
            citas,
        };
    }

    // ============================================================
    // 2) MARCAR ASISTENCIA (cita → COMPLETADA)
    // ============================================================
    async marcarAsistencia(idCita: number) {
        // El repo nos devuelve una Entity Cita (no un Model)
        const cita = await this.repo.obtenerCita(idCita);

        if (!cita) {
            return { ok: false, mensaje: 'La cita no existe' };
        }

        if (cita.estado === 'COMPLETADA') {
            return { ok: false, mensaje: 'La cita ya fue marcada como completada' };
        }

        if (cita.estado === 'CANCELADA' || cita.estado === 'FALTA') {
            return {
                ok: false,
                mensaje: `No se puede marcar asistencia de una cita en estado ${cita.estado}`,
            };
        }

        await this.repo.cambiarEstadoCita(idCita, 'COMPLETADA');

        return {
            ok: true,
            mensaje: 'Asistencia registrada correctamente',
            id_cita: idCita,
            nuevo_estado: 'COMPLETADA',
        };
    }

    // ============================================================
    // 3) MARCAR INASISTENCIA (cita → FALTA + contador + bloqueo)
    // ============================================================
    async marcarInasistencia(idCita: number) {
        const cita = await this.repo.obtenerCita(idCita);

        if (!cita) {
            return { ok: false, mensaje: 'La cita no existe' };
        }

        if (cita.estado === 'FALTA') {
            return { ok: false, mensaje: 'La cita ya fue marcada como inasistencia' };
        }

        if (cita.estado === 'CANCELADA' || cita.estado === 'COMPLETADA') {
            return {
                ok: false,
                mensaje: `No se puede marcar inasistencia de una cita en estado ${cita.estado}`,
            };
        }

        // a) Cambiar estado a FALTA
        await this.repo.cambiarEstadoCita(idCita, 'FALTA');

        // b) Incrementar contador del paciente (usando entity)
        const totalInasistencias = await this.repo.incrementarInasistencias(cita.id_usuario);

        // c) Verificar límite usando la entidad Configuracion
        const config = await this.repo.obtenerConfiguracion('limite_inasistencias');
        const limite = config ? Number(config.valor) : 3;

        let cuentaBloqueada = false;
        if (totalInasistencias >= limite) {
            await this.repo.bloquearCuenta(cita.id_usuario);
            cuentaBloqueada = true;
        }

        return {
            ok: true,
            mensaje: 'Inasistencia registrada correctamente',
            id_cita: idCita,
            nuevo_estado: 'FALTA',
            inasistencias_totales: totalInasistencias,
            limite_configurado: limite,
            cuenta_bloqueada: cuentaBloqueada,
        };
    }
}