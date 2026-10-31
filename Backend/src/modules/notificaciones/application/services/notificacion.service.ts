// =================================================================
// CAPA: Application / Services
// Lógica de negocio del módulo Notificaciones.
// =================================================================
import { INotificacionRepository } from '../../domain/repositories/INotificacionRepository';
import { NotificacionRepository } from '../../infrastructure/repositories/notificacion.repository';

export class NotificacionService {
    private repo: INotificacionRepository = new NotificacionRepository();

    // ============================================================
    // Listar buzón de notificaciones del paciente
    // ============================================================
    async obtenerBuzon(idUsuario: number) {
        const notificaciones = await this.repo.listarPorUsuario(idUsuario);
        const noLeidas = await this.repo.contarNoLeidas(idUsuario);

        return {
            ok: true,
            total: notificaciones.length,
            no_leidas: noLeidas,
            notificaciones,
        };
    }

    // ============================================================
    // Marcar una notificación como leída
    // (verifica que pertenezca al usuario, no se puede leer la de otro)
    // ============================================================
    async marcarLeida(idNotificacion: number, idUsuario: number) {
        const ok = await this.repo.marcarLeida(idNotificacion, idUsuario);

        if (!ok) {
            return {
                ok: false,
                mensaje: 'No se encontró la notificación o no te pertenece',
            };
        }

        return {
            ok: true,
            mensaje: 'Notificación marcada como leída',
            id_notificacion: idNotificacion,
        };
    }
    // ============================================================
    // CRON: Genera recordatorios para citas que serán en 24h.
    // Se ejecuta automáticamente cada hora desde main.ts.
    //
    // Formato del mensaje (según documento del proyecto):
    // "¡[Nombres], tienes una cita programada para el [Fecha]
    //  a las [Hora] en la especialidad de [Especialidad]!"
    // ============================================================
    async generarRecordatorios24h() {
        const citas = await this.repo.obtenerCitasParaRecordatorio();

        let creados = 0;

        for (const c of citas) {
            // Evitar duplicados (si el cron corre varias veces)
            const existe = await this.repo.yaExisteRecordatorio(c.id_cita);
            if (existe) continue;

            // Formatear fecha legible (YYYY-MM-DD → DD/MM/YYYY)
            const fechaObj = new Date(c.fecha);
            const fechaTxt = fechaObj.toLocaleDateString('es-PE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            });

            // Formatear hora (HH:MM:SS → HH:MM)
            const horaTxt = c.hora.substring(0, 5);

            const mensaje = `¡${c.nombres}, tienes una cita programada para el ${fechaTxt} a las ${horaTxt} en la especialidad de ${c.especialidad}!`;

            await this.repo.crearRecordatorio(c.id_cita, c.id_usuario, mensaje);
            creados++;
        }

        return { citas_encontradas: citas.length, recordatorios_creados: creados };
    }
}