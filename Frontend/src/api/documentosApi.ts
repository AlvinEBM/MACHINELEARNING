// =================================================================
// Endpoints del módulo Documentos médicos (agente de IA)
// =================================================================
import { apiClient } from './axios';
import {
    AlertaAnomalia,
    DocumentoListado,
    EstadisticasAgente,
    RegistroAuditoria,
    RespuestaChat,
    ResultadoAcceso,
    SolicitudExcepcional,
} from '../types';

export interface PanelAuditoria {
    ok: boolean;
    estadisticas: EstadisticasAgente;
    registros: RegistroAuditoria[];
    alertas: AlertaAnomalia[];
    solicitudes_pendientes: SolicitudExcepcional[];
}

export const documentosApi = {
    listar: async (): Promise<DocumentoListado[]> => {
        const { data } = await apiClient.get('/documentos');
        return data.documentos ?? [];
    },

    /** El agente de IA decide si se entrega el documento */
    acceder: async (idDocumento: number, solicitudTexto?: string): Promise<ResultadoAcceso> => {
        const { data } = await apiClient.post(`/documentos/${idDocumento}/acceder`, { solicitud_texto: solicitudTexto });
        return data;
    },

    /** Solicitud en lenguaje natural ("necesito la HC de Juan Perez") */
    chat: async (mensaje: string): Promise<RespuestaChat> => {
        const { data } = await apiClient.post('/documentos/chat', { mensaje });
        return data;
    },

    solicitarExcepcional: async (idDocumento: number, motivo: string): Promise<{ ok: boolean; mensaje: string }> => {
        const { data } = await apiClient.post(`/documentos/${idDocumento}/solicitar-excepcional`, { motivo });
        return data;
    },

    misSolicitudes: async (): Promise<SolicitudExcepcional[]> => {
        const { data } = await apiClient.get('/documentos/solicitudes/mias');
        return data.solicitudes ?? [];
    },

    // ----- Solo ADMIN -----
    panelAuditoria: async (limite = 50): Promise<PanelAuditoria> => {
        const { data } = await apiClient.get(`/documentos/auditoria?limite=${limite}`);
        return data;
    },

    responderSolicitud: async (idSolicitud: number, aprobar: boolean): Promise<{ ok: boolean; mensaje: string }> => {
        const { data } = await apiClient.put(`/documentos/solicitudes/${idSolicitud}`, { aprobar });
        return data;
    },

    revisarAlerta: async (idAlerta: number): Promise<{ ok: boolean }> => {
        const { data } = await apiClient.put(`/documentos/alertas/${idAlerta}/revisar`);
        return data;
    },
};
