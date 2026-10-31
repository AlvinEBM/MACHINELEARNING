// =================================================================
// Badge de estado reutilizable
// =================================================================
import { ReactNode } from 'react';
import { EstadoCita } from '../../types';

interface BadgeProps {
    children: ReactNode;
    variante?: 'sky' | 'success' | 'danger' | 'warning' | 'gray';
    conPunto?: boolean;
}

export const Badge = ({ children, variante = 'sky', conPunto = false }: BadgeProps) => {
    const variantes = {
        sky:     'bg-sky-soft text-sky-deep',
        success: 'bg-success-soft text-success-deep',
        danger:  'bg-danger-soft text-danger',
        warning: 'bg-warning-soft text-warning',
        gray:    'bg-gray-100 text-mute',
    };

    const puntoColor = {
        sky:     'bg-sky-main',
        success: 'bg-success',
        danger:  'bg-danger',
        warning: 'bg-warning',
        gray:    'bg-mute',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${variantes[variante]}`}>
            {conPunto && (
                <span className={`w-1.5 h-1.5 rounded-full ${puntoColor[variante]}`} />
            )}
            {children}
        </span>
    );
};

/**
 * Helper: convierte un estado de cita a su badge correspondiente
 */
export const BadgeEstadoCita = ({ estado }: { estado: EstadoCita }) => {
    const config = {
        RESERVADA:  { variante: 'sky' as const,     texto: 'RESERVADA',  conPunto: true },
        EN_CURSO:   { variante: 'warning' as const, texto: 'EN CURSO',   conPunto: true },
        COMPLETADA: { variante: 'success' as const, texto: '✓ COMPLETADA', conPunto: false },
        FALTA:      { variante: 'danger' as const,  texto: '✕ FALTA',    conPunto: false },
        CANCELADA:  { variante: 'gray' as const,    texto: 'CANCELADA',  conPunto: false },
    };
    const c = config[estado as keyof typeof config] ?? config.RESERVADA;

    return <Badge variante={c.variante} conPunto={c.conPunto}>{c.texto}</Badge>;
};