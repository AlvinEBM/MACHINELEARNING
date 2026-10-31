// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /admin/especialidad.
// =================================================================
import {
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class NuevaEspecialidadDTO {
    @IsNotEmpty({ message: 'El nombre de la especialidad es obligatorio' })
    @IsString()
    @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
    @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
    nombre!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    descripcion?: string;
}