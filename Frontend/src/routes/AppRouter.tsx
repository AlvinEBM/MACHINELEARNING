// =================================================================
// Configuración central de rutas de toda la aplicación.
//
// Estructura:
//   /login, /registro              → públicas
//   /paciente/*                    → solo PACIENTE
//   /admision/*                    → solo ADMISION (+ ADMIN supervisión)
//   /admin/*                       → solo ADMIN
//   /personal/documentos           → MEDICO, ENFERMERIA, ADMISION, ADMIN (agente de IA)
// =================================================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../auth/useAuth';

// Páginas públicas
import { Login } from '../pages/public/Login';
import { Registro } from '../pages/public/Registro';

// Páginas paciente
import { Dashboard as DashboardPaciente } from '../pages/paciente/Dashboard';
import { Reservar } from '../pages/paciente/Reservar';
import { MisCitas } from '../pages/paciente/MisCitas';
import { Perfil } from '../pages/paciente/Perfil';

// Páginas admisión
import { CitasHoy } from '../pages/admision/CitasHoy';

// Páginas admin
import { Especialidades } from '../pages/admin/Especialidades';
import { Sanciones } from '../pages/admin/Sanciones';
import { CancelacionMasiva } from '../pages/admin/CancelacionMasiva';
import { CuentasAdmision } from '../pages/admin/CuentasAdmision';
import { Auditoria } from '../pages/admin/Auditoria';

// Páginas del personal de salud (agente de IA de documentos médicos)
import { Documentos } from '../pages/personal/Documentos';

// Mapa de redirección por rol (la misma que en ProtectedRoute)
const RUTA_POR_ROL = {
    PACIENTE:  '/paciente/inicio',
    ADMISION:  '/admision/citas-hoy',
    ADMIN:      '/admin/auditoria',
    MEDICO:     '/personal/documentos',
    ENFERMERIA: '/personal/documentos',
} as const;

/**
 * Componente raíz que decide a dónde mandar al usuario cuando
 * entra a "/" según si está logueado y qué rol tiene.
 */
const RedireccionRaiz = () => {
    const { isAuthenticated, user } = useAuth();
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }
    return <Navigate to={RUTA_POR_ROL[user.rol]} replace />;
};

export const AppRouter = () => {
    return (
        <BrowserRouter>
            <Routes>
                {/* Raíz: redirige según contexto */}
                <Route path="/" element={<RedireccionRaiz />} />

                {/* ============== PÚBLICAS ============== */}
                <Route path="/login"    element={<Login />} />
                <Route path="/registro" element={<Registro />} />

                {/* ============== PACIENTE ============== */}
                <Route
                    path="/paciente/inicio"
                    element={
                        <ProtectedRoute roles={['PACIENTE']}>
                            <DashboardPaciente />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/paciente/reservar"
                    element={
                        <ProtectedRoute roles={['PACIENTE']}>
                            <Reservar />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/paciente/mis-citas"
                    element={
                        <ProtectedRoute roles={['PACIENTE']}>
                            <MisCitas />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/paciente/perfil"
                    element={
                        <ProtectedRoute roles={['PACIENTE']}>
                            <Perfil />
                        </ProtectedRoute>
                    }
                />

                {/* ============== ADMISIÓN ============== */}
                <Route
                    path="/admision/citas-hoy"
                    element={
                        <ProtectedRoute roles={['ADMISION', 'ADMIN']}>
                            <CitasHoy />
                        </ProtectedRoute>
                    }
                />

                {/* ============== ADMIN ============== */}
                <Route
                    path="/admin/especialidades"
                    element={
                        <ProtectedRoute roles={['ADMIN']}>
                            <Especialidades />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/sanciones"
                    element={
                        <ProtectedRoute roles={['ADMIN']}>
                            <Sanciones />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/cancelacion"
                    element={
                        <ProtectedRoute roles={['ADMIN']}>
                            <CancelacionMasiva />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/cuentas-admision"
                    element={
                        <ProtectedRoute roles={['ADMIN']}>
                            <CuentasAdmision />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin/auditoria"
                    element={
                        <ProtectedRoute roles={['ADMIN']}>
                            <Auditoria />
                        </ProtectedRoute>
                    }
                />

                {/* ============== PERSONAL DE SALUD (agente de IA) ============== */}
                <Route
                    path="/personal/documentos"
                    element={
                        <ProtectedRoute roles={['MEDICO', 'ENFERMERIA', 'ADMISION', 'ADMIN']}>
                            <Documentos />
                        </ProtectedRoute>
                    }
                />

                {/* Catch-all: cualquier ruta no definida vuelve a raíz */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
};