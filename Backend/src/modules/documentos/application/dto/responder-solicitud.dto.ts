// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para PUT /documentos/solicitudes/:id (ADMIN)
// =================================================================
import { IsBoolean } from 'class-validator';

export class ResponderSolicitudDTO {
    @IsBoolean({ message: 'aprobar debe ser true o false' })
    aprobar!: boolean;
}
