// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /documentos/:id/acceder
// =================================================================
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AccederDocumentoDTO {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    solicitud_texto?: string;
}
