// =================================================================
// Componente que protege rutas según autenticación y rol.
//
// Uso:
//   <ProtectedRoute roles={['PACIENTE']}>
//       <DashboardPaciente />
//   </ProtectedRoute>
//
// - Si NO está autenticado → redirige a /login
// - Si su rol no está permitido → redirige al dashboard de su propio rol
// =================================================================
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Rol } from '../types';

interface ProtectedRouteProps {
    children: ReactNode;
    roles?: Rol[];
}

// Mapa de redirección según rol (a dónde va cada uno por defecto)
const RUTA_POR_ROL: Record<Rol, string> = {
    PACIENTE:  '/paciente/inicio',
    ADMISION:  '/admision/citas-hoy',
    ADMIN:      '/admin/auditoria',
    MEDICO:     '/personal/documentos',
    ENFERMERIA: '/personal/documentos',
};

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
    const { isAuthenticated, user } = useAuth();

    // 1) No autenticado → al login
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    // 2) Si se pide rol específico y NO lo tiene → redirige a su propio dashboard
    if (roles && roles.length > 0 && !roles.includes(user.rol)) {
        return <Navigate to={RUTA_POR_ROL[user.rol]} replace />;
    }

    // 3) Todo OK → muestra la vista
    return <>{children}</>;
};