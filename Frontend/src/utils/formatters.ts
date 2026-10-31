// =================================================================
// Funciones utilitarias de formato
// =================================================================

/**
 * Convierte una fecha (string YYYY-MM-DD o ISO) a un objeto Date
 * SIN desfase de zona horaria (interpreta como hora local).
 */
const parseFechaLocal = (fecha: string): Date | null => {
    if (!fecha) return null;
    // Tomamos solo la parte de fecha YYYY-MM-DD
    const soloFecha = fecha.slice(0, 10);
    const [a, m, d] = soloFecha.split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d); // mes 0-indexado, hora local 00:00
};

/**
 * Formatea "2026-06-16" a "16 de junio de 2026"
 */
export const formatearFecha = (fecha: string): string => {
    const d = parseFechaLocal(fecha);
    if (!d) return fecha;
    return d.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
};

/**
 * Formatea a "16 jun" (corto)
 */
export const formatearFechaCorta = (fecha: string): string => {
    const d = parseFechaLocal(fecha);
    if (!d) return fecha;
    return d.toLocaleDateString('es-PE', {
        day: 'numeric',
        month: 'short',
    });
};

/**
 * Hora "09:00:00" → "09:00 AM"
 */
export const formatearHora = (hora: string): string => {
    if (!hora) return '';
    const [h, m] = hora.split(':');
    const horaNum = Number(h);
    const sufijo = horaNum >= 12 ? 'PM' : 'AM';
    const hora12 = horaNum % 12 || 12;
    return `${hora12.toString().padStart(2, '0')}:${m} ${sufijo}`;
};

/**
 * Diferencia legible en días desde hoy:
 * - 0 → "Hoy"
 * - 1 → "Mañana"
 * - >1 → "En X días"
 * - <0 → "Hace X días"
 */
export const diasDesdeHoy = (fechaIso: string): string => {
    const fecha = parseFechaLocal(fechaIso);
    if (!fecha) return '';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const diffMs = fecha.getTime() - hoy.getTime();
    const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    if (dias > 1) return `En ${dias} días`;
    if (dias === -1) return 'Ayer';
    return `Hace ${Math.abs(dias)} días`;
};

/**
 * Tiempo relativo desde una fecha-hora (para notificaciones)
 */
export const tiempoRelativo = (fechaIso: string): string => {
    if (!fechaIso) return '';
    const ahora = new Date();
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return '';

    const diffMs = ahora.getTime() - fecha.getTime();
    const minutos = Math.floor(diffMs / 60000);
    const horas   = Math.floor(diffMs / 3600000);
    const dias    = Math.floor(diffMs / 86400000);

    if (minutos < 1)   return 'Ahora mismo';
    if (minutos < 60)  return `Hace ${minutos} min`;
    if (horas < 24)    return `Hace ${horas} h`;
    if (dias === 1)    return 'Ayer';
    if (dias < 7)      return `Hace ${dias} días`;
    return formatearFechaCorta(fechaIso);
};

/**
 * Obtiene iniciales de "Juan Pérez" → "JP"
 */
export const obtenerIniciales = (nombres: string, apellidos: string): string => {
    const i1 = (nombres || '').trim().charAt(0).toUpperCase();
    const i2 = (apellidos || '').trim().charAt(0).toUpperCase();
    return `${i1}${i2}` || '?';
};

/**
 * Capitaliza la primera letra
 */
export const capitalizar = (texto: string): string => {
    if (!texto) return '';
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
};