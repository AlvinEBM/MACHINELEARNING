/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Celeste (color principal)
                'sky-soft':   '#E0F2FE',
                'sky-main':   '#0EA5E9',
                'sky-deep':   '#0369A1',
                'sky-bright': '#38BDF8',

                // Azul (acento para títulos/header)
                'blue-deep':  '#1E3A8A',

                // Blancos
                'pure':       '#FFFFFF',
                'smoke':      '#F8FAFC',

                // Texto
                'ink':        '#0F172A',
                'ink-soft':   '#1E293B',
                'mute':       '#64748B',
                'mute-soft':  '#94A3B8',

                // Estados
                'success':       '#10B981',
                'success-soft':  '#DCFCE7',
                'success-deep':  '#15803D',
                'danger':        '#EF4444',
                'danger-soft':   '#FEF2F2',
                'danger-border': '#FECACA',
                'warning':       '#F59E0B',
                'warning-soft':  '#FFFBEB',
            },
            fontFamily: {
                sans: ['Inter', 'Segoe UI', 'sans-serif'],
            },
            boxShadow: {
                'card':       '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(15, 23, 42, 0.05)',
                'card-hover': '0 4px 20px rgba(14, 165, 233, 0.15)',
                'cta':        '0 10px 30px rgba(14, 165, 233, 0.30)',
                'dropdown':   '0 8px 24px rgba(15, 23, 42, 0.15)',
            },
            animation: {
                'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
            },
            keyframes: {
                'pulse-ring': {
                    '0%':   { transform: 'scale(1)',   opacity: '0.5' },
                    '100%': { transform: 'scale(1.6)', opacity: '0'   },
                },
            },
        },
    },
    plugins: [],
}