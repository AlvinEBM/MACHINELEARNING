// =================================================================
// Header del personal de salud (médico, enfermería, admisión, admin).
// Navegación hacia el módulo de documentos médicos con el agente de IA
// y, para el ADMIN, hacia el panel de auditoría.
// =================================================================
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth';
import { obtenerIniciales } from '../../utils/formatters';
import { Rol } from '../../types';

const NOMBRE_ROL: Record<Rol, string> = {
    MEDICO: 'Médico',
    ENFERMERIA: 'Enfermería',
    ADMISION: 'Admisión',
    ADMIN: 'Administrador',
    PACIENTE: 'Paciente',
};

export const HeaderPersonal = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `relative px-1 py-2 text-sm font-semibold transition-colors ${
            isActive ? 'text-sky-main' : 'text-mute hover:text-ink-soft'
        }`;

    const cerrarSesion = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <header className="sticky top-0 z-40 bg-white shadow-card">
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-main to-sky-deep flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12 L10 17 L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div className="leading-tight">
                        <span className="text-lg font-extrabold text-blue-deep">CareNest</span>
                        <p className="text-[10px] font-bold tracking-widest text-mute">PERSONAL DE SALUD</p>
                    </div>
                </div>

                <nav className="hidden md:flex items-center gap-8">
                    <NavLink to="/personal/documentos" className={linkClass}>
                        {({ isActive }) => (
                            <>
                                Documentos médicos
                                {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-main rounded-full" />}
                            </>
                        )}
                    </NavLink>
                    {user?.rol === 'ADMIN' && (
                        <NavLink to="/admin/auditoria" className={linkClass}>
                            {({ isActive }) => (
                                <>
                                    Auditoría del agente IA
                                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-main rounded-full" />}
                                </>
                            )}
                        </NavLink>
                    )}
                </nav>

                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-ink">{user?.nombres} {user?.apellidos}</p>
                        <p className="text-xs text-mute">{user ? NOMBRE_ROL[user.rol] : ''}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-main to-sky-deep flex items-center justify-center text-white text-sm font-bold">
                        {user ? obtenerIniciales(user.nombres, user.apellidos) : '?'}
                    </div>
                    <button
                        onClick={cerrarSesion}
                        className="px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-soft rounded-lg transition-colors"
                    >
                        Salir
                    </button>
                </div>
            </div>
        </header>
    );
};
