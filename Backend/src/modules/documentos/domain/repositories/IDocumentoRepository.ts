// =================================================================
// CAPA: Domain / Repositories
// Contrato de persistencia del módulo Documentos.
// =================================================================
import { Documento, TipoDocumento } from '../entities/documento.entity';
import { EstadoSolicitud, SolicitudAcceso } from '../entities/solicitud-acceso.entity';

export interface DocumentoListado {
    id_documento: number;
    tipo_documento: TipoDocumento;
    titulo: string;
    fecha_creacion: Date;
    id_paciente: number;
    paciente: string;
    dni_paciente: string | null;
    dependiente: string | null;
    dni_dependiente: string | null;
    medico_tratante: string;
}

export interface IDocumentoRepository {
    /** Lista los documentos con datos del paciente y del médico tratante (sin contenido clínico) */
    listar(): Promise<DocumentoListado[]>;

    buscarPorId(idDocumento: number): Promise<Documento | null>;

    /** Busca documentos por DNI o nombre del paciente/dependiente y, opcionalmente, por tipo */
    buscarPorPaciente(texto: string, tipo?: TipoDocumento | null): Promise<DocumentoListado[]>;

    /** id_medico vinculado a una cuenta de usuario MEDICO */
    medicoPorUsuario(idUsuario: number): Promise<number | null>;

    /** ¿El médico atendió (o tiene cita) con el paciente o su dependiente? */
    medicoAtendioPaciente(idMedico: number, idPaciente: number, idDependiente: number | null): Promise<boolean>;

    /** ¿El paciente tiene citas recientes o próximas (atención en curso)? */
    pacienteTieneCitaEnRango(idPaciente: number, diasAtras: number, diasAdelante: number): Promise<boolean>;

    autorizacionVigente(idUsuario: number, idDocumento: number): Promise<SolicitudAcceso | null>;
    solicitudPendiente(idUsuario: number, idDocumento: number): Promise<SolicitudAcceso | null>;
    crearSolicitud(idUsuario: number, idDocumento: number, motivo: string): Promise<SolicitudAcceso>;
    listarSolicitudes(estado?: EstadoSolicitud, idUsuario?: number): Promise<any[]>;
    buscarSolicitud(idSolicitud: number): Promise<SolicitudAcceso | null>;
    responderSolicitud(idSolicitud: number, idAprobador: number, aprobada: boolean, expiracion: Date | null): Promise<void>;
}
