// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /documentos/:id/solicitar-excepcional
// =================================================================
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SolicitarExcepcionalDTO {
    @IsNotEmpty({ message: 'El motivo es obligatorio' })
    @IsString()
    @MinLength(10, { message: 'Describe el motivo con al menos 10 caracteres' })
    @MaxLength(500)
    motivo!: string;
}
