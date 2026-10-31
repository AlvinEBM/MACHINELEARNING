// =================================================================
// CAPA: Application / Services
// Casos de uso del módulo Documentos médicos.
//
// Flujo de acceso a un documento:
//   1. Obtener el documento solicitado.
//   2. Calcular el contexto del usuario (relación con el paciente y
//      autorización excepcional vigente).
//   3. Pedir la decisión al agente de IA (Árbol de Decisión ->
//      Isolation Forest -> Regresión Logística). El agente registra
//      la solicitud en la auditoría.
//   4. Entregar el contenido SOLO si la decisión es AUTORIZAR.
// =================================================================
import { DocumentoListado, IDocumentoRepository } from '../../domain/repositories/IDocumentoRepository';
import { DocumentoRepository } from '../../infrastructure/repositories/documento.repository';
import { AgenteIAClient, Relacion } from '../../infrastructure/clients/agente-ia.client';
import { Documento } from '../../domain/entities/documento.entity';
import { EstadoSolicitud, SolicitudAcceso } from '../../domain/entities/solicitud-acceso.entity';

export type RolPersonal = 'MEDICO' | 'ENFERMERIA' | 'ADMISION' | 'ADMIN';

const NOMBRE_TIPO: Record<string, string> = {
    historia_clinica: 'historia clínica',
    resultado_laboratorio: 'resultado de laboratorio',
    orden_medica: 'orden médica',
};

export class DocumentoService {
    private repo: IDocumentoRepository = new DocumentoRepository();
    private agente = new AgenteIAClient();

    // ============================================================
    // Listado de documentos (sin contenido clínico)
    // ============================================================
    async listar() {
        const documentos = await this.repo.listar();
        return { ok: true, total: documentos.length, documentos };
    }

    // ============================================================
    // Relación del usuario con el paciente del documento
    // ============================================================
    private async calcularRelacion(idUsuario: number, rol: RolPersonal, doc: Documento): Promise<Relacion> {
        if (rol === 'MEDICO') {
            const idMedico = await this.repo.medicoPorUsuario(idUsuario);
            if (!idMedico) return 'sin_relacion';
            if (idMedico === doc.id_medico_tratante) return 'medico_tratante';
            const atendio = await this.repo.medicoAtendioPaciente(idMedico, doc.id_paciente, doc.id_dependiente);
            return atendio ? 'personal_apoyo' : 'sin_relacion';
        }
        if (rol === 'ENFERMERIA') {
            // Enfermería participa en la atención si el paciente tiene citas recientes o próximas (triaje)
            const enAtencion = await this.repo.pacienteTieneCitaEnRango(doc.id_paciente, 30, 7);
            return enAtencion ? 'personal_apoyo' : 'sin_relacion';
        }
        if (rol === 'ADMISION') {
            const citaHoy = await this.repo.pacienteTieneCitaEnRango(doc.id_paciente, 0, 0);
            return citaHoy ? 'personal_apoyo' : 'sin_relacion';
        }
        return 'sin_relacion'; // ADMIN: supervisa, no atiende
    }

    // ============================================================
    // Acceder a un documento (decide el agente de IA)
    // ============================================================
    async acceder(idUsuario: number, rol: RolPersonal, idDocumento: number, solicitudTexto?: string | null) {
        const doc = await this.repo.buscarPorId(idDocumento);
        if (!doc) {
            return { ok: false, codigo: 404, mensaje: 'Documento no encontrado' };
        }

        const relacion = await this.calcularRelacion(idUsuario, rol, doc);
        const autorizacion = await this.repo.autorizacionVigente(idUsuario, idDocumento);

        const evaluacion = await this.agente.evaluarAcceso({
            usuario_id: idUsuario,
            rol,
            tipo_documento: doc.tipo_documento,
            relacion_paciente: relacion,
            autorizacion_excepcional: !!autorizacion,
            documento_id: doc.id_documento,
            paciente_id: doc.id_paciente,
            solicitud_texto: solicitudTexto ?? null,
        });

        const autorizado = evaluacion.decision === 'AUTORIZAR';
        const pendiente = autorizado ? null : await this.repo.solicitudPendiente(idUsuario, idDocumento);

        return {
            ok: true,
            decision: evaluacion.decision,
            explicacion: evaluacion.explicacion,
            contexto: {
                relacion_paciente: relacion,
                autorizacion_excepcional: !!autorizacion,
                autorizacion_expira: autorizacion?.fecha_expiracion ?? null,
            },
            evaluacion: {
                decision_arbol: evaluacion.decision_arbol,
                score_anomalia: evaluacion.score_anomalia,
                nivel_alerta: evaluacion.nivel_alerta,
                prob_legitimidad: evaluacion.prob_legitimidad,
                ruta_arbol: evaluacion.ruta_arbol,
                tiempo_respuesta_ms: evaluacion.tiempo_respuesta_ms,
                id_log: evaluacion.id_log,
            },
            documento: autorizado ? { ...doc.resumen(), contenido: doc.contenido } : doc.resumen(),
            solicitud_pendiente: pendiente ? pendiente.id_solicitud : null,
            puede_solicitar_excepcional: !autorizado && !pendiente && evaluacion.nivel_alerta !== 'CRITICO',
        };
    }

    // ============================================================
    // Chat: solicitud en lenguaje natural ("necesito la HC de Juan")
    // ============================================================
    async chat(idUsuario: number, rol: RolPersonal, mensaje: string) {
        let nlp;
        try {
            nlp = await this.agente.interpretar(mensaje);
        } catch {
            return { ok: false, codigo: 503, mensaje: 'El agente de IA no está disponible en este momento.' };
        }

        if (!nlp.tipo_documento && !nlp.paciente) {
            return { ok: true, tipo: 'aclaracion', interpretacion: nlp,
                     respuesta: 'No identifiqué qué documento necesitas ni de qué paciente. Ejemplo: «Necesito la historia clínica de Juan Perez».' };
        }
        if (!nlp.paciente) {
            return { ok: true, tipo: 'aclaracion', interpretacion: nlp,
                     respuesta: `Entendí que necesitas ${this.articulo(nlp.tipo_documento)}. ¿De qué paciente? Indica su nombre o DNI.` };
        }

        const encontrados = this.filtrarPorTitular(
            await this.repo.buscarPorPaciente(nlp.paciente, nlp.tipo_documento), nlp.paciente);
        if (encontrados.length === 0) {
            return { ok: true, tipo: 'sin_resultados', interpretacion: nlp,
                     respuesta: `No encontré ${nlp.tipo_documento ? this.articulo(nlp.tipo_documento) : 'documentos'} del paciente «${nlp.paciente}».` };
        }

        const pacientes = new Set(encontrados.map(d => `${d.id_paciente}-${d.dependiente ?? ''}`));
        if (pacientes.size > 1 || !nlp.tipo_documento) {
            return { ok: true, tipo: 'opciones', interpretacion: nlp,
                     respuesta: 'Encontré varias coincidencias. Elige el documento que necesitas:',
                     opciones: encontrados };
        }

        // Un solo paciente y tipo identificado: se toma el documento más reciente
        const elegido = encontrados[encontrados.length - 1];
        const resultado = await this.acceder(idUsuario, rol, elegido.id_documento, mensaje);
        return { tipo: 'decision', interpretacion: nlp, documento_listado: elegido, ...resultado };
    }

    /**
     * Un documento pertenece al dependiente (menor) o al titular. Si el texto nombra al titular
     * ("Juan Perez"), se descartan los documentos de sus dependientes, y viceversa.
     */
    private filtrarPorTitular(docs: DocumentoListado[], texto: string): DocumentoListado[] {
        const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const palabras = norm(texto).split(/\s+/).filter(p => p.length > 1);
        const coincide = (d: DocumentoListado) => {
            if (/^\d{8}$/.test(texto.trim())) {
                return d.dependiente ? d.dni_dependiente === texto.trim() : d.dni_paciente === texto.trim();
            }
            const objetivo = norm(d.dependiente ?? d.paciente);
            return palabras.every(p => objetivo.includes(p));
        };
        const filtrados = docs.filter(coincide);
        return filtrados.length > 0 ? filtrados : docs;
    }

    private articulo(tipo: string | null): string {
        if (tipo === 'resultado_laboratorio') return 'un resultado de laboratorio';
        if (tipo === 'orden_medica') return 'una orden médica';
        return 'una historia clínica';
    }

    // ============================================================
    // Autorizaciones excepcionales
    // ============================================================
    async solicitarExcepcional(idUsuario: number, idDocumento: number, motivo: string) {
        const doc = await this.repo.buscarPorId(idDocumento);
        if (!doc) return { ok: false, codigo: 404, mensaje: 'Documento no encontrado' };

        const pendiente = await this.repo.solicitudPendiente(idUsuario, idDocumento);
        if (pendiente) {
            return { ok: false, codigo: 409, mensaje: 'Ya tienes una solicitud pendiente para este documento' };
        }
        const solicitud = await this.repo.crearSolicitud(idUsuario, idDocumento, motivo);
        return {
            ok: true,
            mensaje: `Solicitud enviada a la administración para acceder a la ${NOMBRE_TIPO[doc.tipo_documento]}.`,
            solicitud,
        };
    }

    async listarSolicitudes(estado?: EstadoSolicitud) {
        const solicitudes = await this.repo.listarSolicitudes(estado);
        return { ok: true, total: solicitudes.length, solicitudes };
    }

    async misSolicitudes(idUsuario: number) {
        const solicitudes = await this.repo.listarSolicitudes(undefined, idUsuario);
        return { ok: true, total: solicitudes.length, solicitudes };
    }

    async responderSolicitud(idAdmin: number, idSolicitud: number, aprobar: boolean) {
        const solicitud = await this.repo.buscarSolicitud(idSolicitud);
        if (!solicitud) return { ok: false, codigo: 404, mensaje: 'Solicitud no encontrada' };
        if (solicitud.estado !== 'PENDIENTE') {
            return { ok: false, codigo: 409, mensaje: `La solicitud ya fue ${solicitud.estado.toLowerCase()}` };
        }
        const expiracion = aprobar
            ? new Date(Date.now() + SolicitudAcceso.HORAS_VIGENCIA * 60 * 60 * 1000)
            : null;
        await this.repo.responderSolicitud(idSolicitud, idAdmin, aprobar, expiracion);
        return {
            ok: true,
            mensaje: aprobar
                ? `Solicitud aprobada: acceso temporal por ${SolicitudAcceso.HORAS_VIGENCIA} horas.`
                : 'Solicitud rechazada.',
            id_solicitud: idSolicitud,
            fecha_expiracion: expiracion,
        };
    }

    // ============================================================
    // Panel de auditoría (datos del agente)
    // ============================================================
    async panelAuditoria(limite: number) {
        try {
            const [estadisticas, auditoria, alertas] = await Promise.all([
                this.agente.estadisticas(),
                this.agente.auditoria(limite),
                this.agente.alertas(false),
            ]);
            const pendientes = await this.repo.listarSolicitudes('PENDIENTE');
            return {
                ok: true,
                estadisticas,
                registros: auditoria.registros,
                alertas: alertas.alertas,
                solicitudes_pendientes: pendientes,
            };
        } catch (e) {
            return { ok: false, codigo: 503, mensaje: 'El agente de IA no está disponible: ' + (e as Error).message };
        }
    }

    async revisarAlerta(idAlerta: number) {
        try {
            return await this.agente.revisarAlerta(idAlerta);
        } catch (e) {
            return { ok: false, codigo: 404, mensaje: (e as Error).message };
        }
    }

    async estadoAgente() {
        try {
            return { ok: true, agente: await this.agente.salud() };
        } catch (e) {
            return { ok: false, codigo: 503, mensaje: 'El agente de IA no está disponible' };
        }
    }
}
