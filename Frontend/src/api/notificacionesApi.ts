// =================================================================
// Endpoints del módulo Notificaciones
// =================================================================
import { apiClient } from './axios';
import { Notificacion } from '../types';

export interface BuzonResponse {
    ok: boolean;
    total: number;
    no_leidas: number;
    notificaciones: Notificacion[];
}

export const notificacionesApi = {
    /**
     * GET /notificaciones/buzon → solo PACIENTE
     */
    obtenerBuzon: async (): Promise<BuzonResponse> => {
        const response = await apiClient.get<BuzonResponse>('/notificaciones/buzon');
        return response.data;
    },

    /**
     * PUT /notificaciones/:id/leida
     */
    marcarLeida: async (idNotificacion: number): Promise<{ ok: boolean }> => {
        const response = await apiClient.put(`/notificaciones/${idNotificacion}/leida`);
        return response.data;
    },
};