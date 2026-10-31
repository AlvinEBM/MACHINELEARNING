// =================================================================
// CAPA: Infrastructure / Mapping
// Traduce entre los models TypeORM y las entidades del dominio.
// =================================================================
import { DocumentoModel } from '../models/documento.model';
import { AccessRequestModel } from '../models/access-request.model';
import { Documento } from '../../domain/entities/documento.entity';
import { SolicitudAcceso } from '../../domain/entities/solicitud-acceso.entity';

export class DocumentoMapping {
    static toDomain(m: DocumentoModel): Documento {
        return new Documento(
            m.id_documento,
            m.id_paciente,
            m.id_dependiente,
            m.tipo_documento,
            m.titulo,
            m.contenido,
            m.id_medico_tratante,
            m.fecha_creacion,
        );
    }

    static solicitudToDomain(m: AccessRequestModel): SolicitudAcceso {
        return new SolicitudAcceso(
            m.id_solicitud,
            m.id_usuario,
            m.id_documento,
            m.motivo,
            m.estado,
            m.id_aprobador,
            m.fecha_solicitud,
            m.fecha_respuesta,
            m.fecha_expiracion,
        );
    }
}
