// =================================================================
// Endpoints de autenticación
// =================================================================
import { apiClient } from './axios';
import { LoginResponse } from '../types';

export interface LoginPayload {
    correo: string;
    contrasena: string;
}

export interface RegistroPayload {
    correo: string;
    contrasena: string;
    dni: string;
    nombres: string;
    apellidos: string;
    telefono: string;
    genero: 'Masculino' | 'Femenino' | 'Otros';
    fecha_nacimiento?: string;
    direccion?: string;
}

export const authApi = {
    /**
     * POST /auth/login → devuelve token + datos del usuario
     */
    login: async (data: LoginPayload): Promise<LoginResponse> => {
        const response = await apiClient.post<LoginResponse>('/auth/login', data);
        return response.data;
    },

    /**
     * POST /auth/register → registro de nuevo PACIENTE
     * El backend fuerza el rol PACIENTE mediante UsuarioFactory
     */
    register: async (data: RegistroPayload): Promise<{ ok: boolean; mensaje: string; id_usuario?: number }> => {
        const response = await apiClient.post('/auth/register', data);
        return response.data;
    },
};