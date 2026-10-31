// =================================================================
// Input reutilizable con label y mensaje de error
// =================================================================
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icono?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icono, className = '', ...props }, ref) => {
        const tieneError = !!error;
        const borderClass = tieneError ? 'border-danger' : 'border-gray-200 focus:border-sky-main';

        return (
            <div className="w-full">
                {label && (
                    <label className="block text-xs font-semibold text-ink-soft mb-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icono && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mute pointer-events-none">
                            {icono}
                        </span>
                    )}
                    <input
                        ref={ref}
                        className={`
                            w-full px-4 py-3 text-sm bg-white rounded-lg border outline-none transition-colors
                            ${icono ? 'pl-10' : ''}
                            ${borderClass}
                            placeholder:text-mute-soft
                            ${className}
                        `}
                        {...props}
                    />
                </div>
                {tieneError && (
                    <p className="mt-1.5 text-xs text-danger font-medium">{error}</p>
                )}
            </div>
        );
    },
);

Input.displayName = 'Input';