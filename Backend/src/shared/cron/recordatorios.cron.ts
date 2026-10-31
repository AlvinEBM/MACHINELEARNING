// =================================================================
// CAPA: Shared / Cron
// Job que corre periódicamente para generar recordatorios de citas.
//
// Frecuencia: cada hora en el minuto 0 (0 * * * *).
// El service busca citas que serán en ~24 horas y genera una
// notificación de tipo RECORDATORIO para cada una.
// =================================================================
import cron from 'node-cron';

import { NotificacionService } from '../../modules/notificaciones/application/services/notificacion.service';

const service = new NotificacionService();

/**
 * Inicia el cron job de recordatorios.
 * Se llama desde main.ts después de conectar a la BD.
 */
export const iniciarCronRecordatorios = () => {
    // Patrón cron: '0 * * * *' = cada hora en el minuto 0
    cron.schedule('0 * * * *', async () => {
        const hora = new Date().toLocaleTimeString('es-PE');
        console.log(`[CRON ${hora}] Generando recordatorios de citas en 24h...`);

        try {
            const result = await service.generarRecordatorios24h();
            console.log(`[CRON] Citas encontradas: ${result.citas_encontradas}, recordatorios creados: ${result.recordatorios_creados}`);
        } catch (error) {
            console.error('[CRON] Error generando recordatorios:', error);
        }
    });

    console.log('Cron de recordatorios iniciado (cada hora)');
};