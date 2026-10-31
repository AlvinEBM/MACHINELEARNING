// =================================================================
// CAPA: Domain / Config
// Reglas de negocio para la generación automática de horarios.
//
// Los horarios NO se guardan en BD: se generan al vuelo según
// estas reglas y se filtran contra las citas ya reservadas.
// =================================================================

export const HORARIO_CONFIG = {
    // Hora de inicio de atención (formato 24h)
    horaInicio: 8,        // 08:00

    // Hora de fin de atención (formato 24h)
    horaFin: 13,          // 13:00 (la última cita es a las 12:30)

    // Duración de cada cita en minutos
    duracionMinutos: 30,

    // Refrigerio: rango bloqueado (no se generan slots aquí)
    refrigerioInicio: 12, // 12:00
    refrigerioFin: 13,    // 13:00

    // Días laborables (0=Domingo, 1=Lunes, ..., 6=Sábado)
    diasLaborables: [1, 2, 3, 4, 5, 6], // Lunes a Sábado

    // Ventana de reserva hacia adelante (en días)
    ventanaDias: 60,      // ~2 meses
};

/**
 * Determina si una fecha está dentro de la ventana de reserva permitida.
 * - No puede ser en el pasado.
 * - No puede superar la ventana de 2 meses.
 * - Debe ser un día laborable.
 */
export function fechaEsReservable(fecha: string): { ok: boolean; motivo?: string } {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const objetivo = new Date(fecha + 'T00:00:00');
    objetivo.setHours(0, 0, 0, 0);

    if (isNaN(objetivo.getTime())) {
        return { ok: false, motivo: 'Fecha inválida' };
    }

    // No en el pasado
    if (objetivo < hoy) {
        return { ok: false, motivo: 'No se puede reservar en fechas pasadas' };
    }

    // No más allá de la ventana
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + HORARIO_CONFIG.ventanaDias);
    if (objetivo > limite) {
        return {
            ok: false,
            motivo: `Solo puedes reservar hasta ${HORARIO_CONFIG.ventanaDias} días en adelante`,
        };
    }

    // Debe ser día laborable
    if (!HORARIO_CONFIG.diasLaborables.includes(objetivo.getDay())) {
        return { ok: false, motivo: 'Ese día no hay atención (no laborable)' };
    }

    return { ok: true };
}

/**
 * Genera todos los slots horarios de un día según la configuración.
 * Devuelve array de strings "HH:MM:SS".
 */
export function generarSlotsDelDia(): string[] {
    const slots: string[] = [];
    const { horaInicio, horaFin, duracionMinutos, refrigerioInicio, refrigerioFin } = HORARIO_CONFIG;

    let minutos = horaInicio * 60;
    const finMinutos = horaFin * 60;
    const refInicioMin = refrigerioInicio * 60;
    const refFinMin = refrigerioFin * 60;

    while (minutos < finMinutos) {
        // Saltar el refrigerio
        if (minutos >= refInicioMin && minutos < refFinMin) {
            minutos += duracionMinutos;
            continue;
        }

        const h = Math.floor(minutos / 60);
        const m = minutos % 60;
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        slots.push(`${hh}:${mm}:00`);

        minutos += duracionMinutos;
    }

    return slots;
}