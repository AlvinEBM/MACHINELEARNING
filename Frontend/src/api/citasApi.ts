// =================================================================
// Endpoints del módulo Citas
// =================================================================
import { apiClient } from './axios';
import {
    Especialidad,
    Horario,
    Cita,
    CitaConDetalles,
    ContadoresPaciente,
    DiaCalendario,
} from '../types';

export interface ReservarPayload {
    fecha: string;             // "2026-06-16"
    hora: string;              // "08:00:00"
    id_especialidad: number;
    motivo: string;
    notas?: string;
    id_dependiente?: number;
}

export const citasApi = {
    listarEspecialidades: async (): Promise<Especialidad[]> => {
        const response = await apiClient.get('/citas/especialidades');
        return response.data.especialidades ?? response.data ?? [];
    },

    // Horarios (slots) de un día concreto
    listarHorarios: async (fecha: string, idEspecialidad: number): Promise<Horario[]> => {
        const response = await apiClient.get('/citas/horarios', {
            params: { fecha, especialidad: idEspecialidad },
        });
        return response.data.horarios ?? [];
    },

    // Calendario de un mes (para pintar disponibilidad por día)
    obtenerCalendario: async (anio: number, mes: number, idEspecialidad: number): Promise<DiaCalendario[]> => {
        const response = await apiClient.get('/citas/calendario', {
            params: { anio, mes, especialidad: idEspecialidad },
        });
        return response.data.dias ?? [];
    },

    reservar: async (data: ReservarPayload): Promise<{ ok: boolean; mensaje: string; cita?: Cita }> => {
        const response = await apiClient.post('/citas/reservar', data);
        return response.data;
    },

    // Cancelar una cita del paciente
    cancelar: async (idCita: number): Promise<{ ok: boolean; mensaje: string }> => {
        const response = await apiClient.put(`/citas/${idCita}/cancelar`);
        return response.data;
    },

    misCitas: async (): Promise<CitaConDetalles[]> => {
        const response = await apiClient.get('/citas/mis-citas');
        return response.data.citas ?? response.data ?? [];
    },

    contadores: async (): Promise<ContadoresPaciente> => {
        const response = await apiClient.get('/citas/contadores');
        return response.data.contadores ?? response.data ?? {
            total: 0, completadas: 0, proximas: 0, canceladas: 0, faltas: 0,
        };
    },
};