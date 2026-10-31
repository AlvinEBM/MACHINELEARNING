// =================================================================
// Botón reutilizable con variantes
// =================================================================
import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Tamano = 'sm' | 'md' | 'lg';

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variante?: Variante;
    tamano?: Tamano;
    fullWidth?: boolean;
    children: ReactNode;
}

export const Boton = ({
    variante = 'primary',
    tamano = 'md',
    fullWidth = false,
    children,
    className = '',
    ...props
}: BotonProps) => {
    const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantes: Record<Variante, string> = {
        primary:   'bg-sky-main hover:bg-sky-deep text-white shadow-card hover:shadow-cta',
        secondary: 'bg-white hover:bg-smoke text-mute border border-gray-200',
        danger:    'bg-white hover:bg-danger-soft text-danger border border-danger-border',
        ghost:     'bg-transparent hover:bg-sky-soft text-sky-deep',
        success:   'bg-success hover:bg-success-deep text-white',
    };

    const tamanos: Record<Tamano, string> = {
        sm: 'px-3 py-2 text-xs',
        md: 'px-5 py-3 text-sm',
        lg: 'px-7 py-4 text-base',
    };

    const width = fullWidth ? 'w-full' : '';

    return (
        <button
            className={`${base} ${variantes[variante]} ${tamanos[tamano]} ${width} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};