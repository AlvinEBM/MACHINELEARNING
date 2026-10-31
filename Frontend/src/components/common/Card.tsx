// =================================================================
// Card base reutilizable
// =================================================================
import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    bordeLateral?: 'sky' | 'success' | 'danger' | 'warning' | null;
}

export const Card = ({ children, className = '', bordeLateral = null, ...props }: CardProps) => {
    const bordeClasses: Record<string, string> = {
        sky:     'border-l-[6px] border-l-sky-main',
        success: 'border-l-[6px] border-l-success',
        danger:  'border-l-[6px] border-l-danger',
        warning: 'border-l-[6px] border-l-warning',
    };

    const borde = bordeLateral ? bordeClasses[bordeLateral] : '';

    return (
        <div
            className={`bg-white rounded-2xl shadow-card overflow-hidden ${borde} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};