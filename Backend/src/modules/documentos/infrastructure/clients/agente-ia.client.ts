// =================================================================
// CAPA: Infrastructure / Clients
// Cliente HTTP del microservicio Python del agente de IA (FastAPI).
//
// Variables de entorno:
//   AGENTE_IA_URL   (por defecto http://localhost:8000)
//   AGENTE_API_KEY  (opcional; se envía en la cabecera X-API-Key)
//
// Principio de seguridad "fail-closed": si el agente no responde,
// el acceso se DENIEGA en lugar de concederse sin evaluación.
// =================================================================
export type Decision = 'AUTORIZAR' | 'RECHAZAR' | 'REQUIERE_APROBACION';
export type Relacion = 'medico_tratante' | 'personal_apoyo' | 'sin_relacion';

export interface SolicitudAgente {
    usuario_id: number;
    rol: string;
    tipo_documento: string;
    relacion_paciente: Relacion;
    autorizacion_excepcional: boolean;
    documento_id?: number;
    paciente_id?: number;
    solicitud_texto?: string | null;
}

export interface EvaluacionAgente {
    ok: boolean;
    decision: Decision;
    decision_arbol: Decision | null;
    score_anomalia: number | null;
    nivel_alerta: 'NORMAL' | 'ADVERTENCIA' | 'CRITICO' | 'NO_DISPONIBLE';
    prob_legitimidad: number | null;
    explicacion: string;
    ruta_arbol: string[];
    tiempo_respuesta_ms: number | null;
    id_log: number | null;
}

export interface InterpretacionAgente {
    ok: boolean;
    tipo_documento: 'historia_clinica' | 'resultado_laboratorio' | 'orden_medica' | null;
    paciente: string | null;
    es_dni: boolean;
    justificacion: string | null;
    completo: boolean;
}

export class AgenteIAClient {
    private baseUrl = process.env.AGENTE_IA_URL || 'http://localhost:8000';
    private apiKey = process.env.AGENTE_API_KEY;

    private async llamar<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;

        const resp = await fetch(`${this.baseUrl}${ruta}`, {
            method: opciones.metodo || 'GET',
            headers,
            body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
            signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) {
            const detalle = await resp.text();
            throw new Error(`Agente IA respondió ${resp.status}: ${detalle}`);
        }
        return (await resp.json()) as T;
    }

    async evaluarAcceso(solicitud: SolicitudAgente): Promise<EvaluacionAgente> {
        try {
            return await this.llamar<EvaluacionAgente>('/api/evaluaracceso', { metodo: 'POST', cuerpo: solicitud });
        } catch (error) {
            console.error('Agente IA no disponible:', (error as Error).message);
            return {
                ok: false,
                decision: 'RECHAZAR',
                decision_arbol: null,
                score_anomalia: null,
                nivel_alerta: 'NO_DISPONIBLE',
                prob_legitimidad: null,
                explicacion: 'El agente de IA no está disponible en este momento; por seguridad se denegó el acceso. Intenta nuevamente en unos minutos.',
                ruta_arbol: [],
                tiempo_respuesta_ms: null,
                id_log: null,
            };
        }
    }

    interpretar(mensaje: string): Promise<InterpretacionAgente> {
        return this.llamar<InterpretacionAgente>('/api/interpretar', { metodo: 'POST', cuerpo: { mensaje } });
    }

    estadisticas(): Promise<any> {
        return this.llamar('/api/estadisticas');
    }

    auditoria(limite = 50): Promise<any> {
        return this.llamar(`/api/auditoria?limite=${limite}`);
    }

    alertas(soloPendientes = false): Promise<any> {
        return this.llamar(`/api/alertas?solo_pendientes=${soloPendientes}`);
    }

    revisarAlerta(idAlerta: number): Promise<any> {
        return this.llamar(`/api/alertas/${idAlerta}/revisar`, { metodo: 'PUT' });
    }

    salud(): Promise<any> {
        return this.llamar('/health');
    }
}
