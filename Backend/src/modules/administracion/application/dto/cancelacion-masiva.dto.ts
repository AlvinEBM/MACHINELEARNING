// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /admin/cancelacion-masiva.
// =================================================================
import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsPositive,
    IsString,
    MaxLength,
} from 'class-validator';

export class CancelacionMasivaDTO {
    @IsNotEmpty({ message: 'La fecha es obligatoria' })
    @IsDateString({}, { message: 'La fecha debe tener formato YYYY-MM-DD' })
    fecha!: string;

    @IsNotEmpty({ message: 'El id_especialidad es obligatorio' })
    @IsInt({ message: 'El id_especialidad debe ser un entero' })
    @IsPositive({ message: 'El id_especialidad debe ser positivo' })
    id_especialidad!: number;

    @IsNotEmpty({ message: 'El motivo es obligatorio' })
    @IsString()
    @MaxLength(300)
    motivo!: string;
}