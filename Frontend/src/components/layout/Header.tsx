// =================================================================
// Header global del paciente.
// Contiene logo, navegación, icono buzón con dropdown y avatar con menú.
// =================================================================
import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth';
import { obtenerIniciales } from '../../utils/formatters';
import { notificacionesApi } from '../../api/notificacionesApi';
import { DropdownBuzon } from './DropdownBuzon';

export const Header = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [abiertoMenu, setAbiertoMenu]   = useState(false);
    const [abiertoBuzon, setAbiertoBuzon] = useState(false);
    const [noLeidas, setNoLeidas]         = useState(0);

    const menuRef = useRef<HTMLDivElement>(null);

    // Cierre del menú perfil al hacer click fuera
    useEffect(() => {
        if (!abiertoMenu) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setAbiertoMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [abiertoMenu]);

    // Cargar contador de no leídas al montar
    useEffect(() => {
        (async () => {
            try {
                const data = await notificacionesApi.obtenerBuzon();
                setNoLeidas(data.no_leidas ?? 0);
            } catch {
                // sin notificaciones disponibles, no es bloqueante
            }
        })();
    }, []);

    const cerrarSesion = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `relative px-1 py-2 text-sm font-semibold transition-colors ${
            isActive ? 'text-sky-main' : 'text-mute hover:text-ink-soft'
        }`;

    return (
        <header className="sticky top-0 z-40 bg-white shadow-card">
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-main to-sky-deep flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12 L10 17 L19 8"
                                  stroke="white" strokeWidth="3"
                                  strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="text-lg font-extrabold text-blue-deep">CareNest</span>
                </div>

                {/* Nav central */}
                <nav className="hidden md:flex items-center gap-8">
                    <NavLink to="/paciente/inicio" className={linkClass}>
                        {({ isActive }) => (
                            <>
                                Inicio
                                {isActive && <span className="absolute -bottom-0 left-0 right-0 h-0.5 bg-sky-main rounded-full" />}
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/paciente/reservar" className={linkClass}>
                        {({ isActive }) => (
                            <>
                                Reservar cita
                                {isActive && <span className="absolute -bottom-0 left-0 right-0 h-0.5 bg-sky-main rounded-full" />}
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/paciente/mis-citas" className={linkClass}>
                        {({ isActive }) => (
                            <>
                                Mis citas
                                {isActive && <span className="absolute -bottom-0 left-0 right-0 h-0.5 bg-sky-main rounded-full" />}
                            </>
                        )}
                    </NavLink>
                </nav>

                {/* Acciones derecha */}
                <div className="flex items-center gap-3">
                    {/* Buzón */}
                    <div className="relative">
                        <button
                            onClick={() => setAbiertoBuzon(prev => !prev)}
                            className="relative w-10 h-10 rounded-full bg-smoke hover:bg-sky-soft flex items-center justify-center transition-colors"
                            aria-label="Notificaciones"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M6 8a6 6 0 0 1 12 0v5l1.5 2.5h-15L6 13V8z"
                                      stroke="#475569" strokeWidth="1.8"
                                      strokeLinejoin="round" strokeLinecap="round" />
                                <path d="M10 19a2 2 0 0 0 4 0"
                                      stroke="#475569" strokeWidth="1.8"
                                      strokeLinecap="round" />
                            </svg>
                            {noLeidas > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                                    {noLeidas > 9 ? '9+' : noLeidas}
                                </span>
                            )}
                        </button>
                        <DropdownBuzon
                            abierto={abiertoBuzon}
                            onCerrar={() => setAbiertoBuzon(false)}
                            onCambioNoLeidas={setNoLeidas}
                        />
                    </div>

                    {/* Avatar con menú */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setAbiertoMenu(prev => !prev)}
                            className="flex items-center gap-2 group"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-main to-sky-deep flex items-center justify-center text-white text-sm font-bold">
                                {user ? obtenerIniciales(user.nombres, user.apellidos) : '?'}
                            </div>
                            <span className="text-mute group-hover:text-ink-soft text-sm">▾</span>
                        </button>

                        {abiertoMenu && (
                            <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-dropdown border border-gray-100 overflow-hidden">
                                {/* Header del menú */}
                                <div className="px-4 py-3 bg-smoke border-b border-gray-100">
                                    <p className="text-sm font-bold text-ink truncate">{user?.nombres} {user?.apellidos}</p>
                                    <p className="text-xs text-mute truncate">{user?.correo}</p>
                                </div>

                                {/* Opciones */}
                                <button
                                    onClick={() => { setAbiertoMenu(false); navigate('/paciente/perfil'); }}
                                    className="w-full px-4 py-3 text-left text-sm text-ink-soft hover:bg-sky-soft hover:text-sky-deep transition-colors flex items-center gap-3"
                                >
                                    <span>👤</span> Mi perfil
                                </button>
                                <button
                                    onClick={() => { setAbiertoMenu(false); navigate('/paciente/mis-citas'); }}
                                    className="w-full px-4 py-3 text-left text-sm text-ink-soft hover:bg-sky-soft hover:text-sky-deep transition-colors flex items-center gap-3"
                                >
                                    <span>📅</span> Mis citas
                                </button>
                                <div className="h-px bg-gray-100" />
                                <button
                                    onClick={cerrarSesion}
                                    className="w-full px-4 py-3 text-left text-sm text-danger hover:bg-danger-soft transition-colors flex items-center gap-3"
                                >
                                    <span>🚪</span> Cerrar sesión
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};