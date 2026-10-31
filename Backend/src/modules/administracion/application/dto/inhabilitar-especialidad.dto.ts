// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para PUT /admin/especialidad/inhabilitar.
// =================================================================
import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsPositive,
    IsString,
    MaxLength,
} from 'class-validator';

export class InhabilitarEspecialidadDTO {
    @IsNotEmpty({ message: 'El id_especialidad es obligatorio' })
    @IsInt()
    @IsPositive()
    id_especialidad!: number;

    @IsNotEmpty({ message: 'La fecha desde es obligatoria' })
    @IsDateString({}, { message: 'desde debe tener formato YYYY-MM-DD' })
    desde!: string;

    @IsNotEmpty({ message: 'La fecha hasta es obligatoria' })
    @IsDateString({}, { message: 'hasta debe tener formato YYYY-MM-DD' })
    hasta!: string;

    @IsNotEmpty({ message: 'El motivo es obligatorio' })
    @IsString()
    @MaxLength(300)
    motivo!: string;
}