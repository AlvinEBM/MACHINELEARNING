
// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /citas/reservar.
//
// CAMBIO (Enfoque A1 - horarios virtuales):
//   Ya NO se envía id_horario (los horarios se generan al vuelo).
//   Ahora se envía fecha + hora + especialidad. El backend crea
//   el registro de horario en BD solo al momento de reservar.
//
// El id_usuario NO se pide al cliente, se extrae del JWT.
// =================================================================
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    MaxLength,
    Matches,
} from 'class-validator';

export class ReservarCitaDTO {
    @IsNotEmpty({ message: 'La fecha es obligatoria' })
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato YYYY-MM-DD' })
    fecha!: string;

    @IsNotEmpty({ message: 'La hora es obligatoria' })
    @IsString()
    @Matches(/^\d{2}:\d{2}:\d{2}$/, { message: 'La hora debe tener formato HH:MM:SS' })
    hora!: string;

    @IsNotEmpty({ message: 'El id_especialidad es obligatorio' })
    @IsInt({ message: 'El id_especialidad debe ser un entero' })
    @IsPositive({ message: 'El id_especialidad debe ser positivo' })
    id_especialidad!: number;

    @IsOptional()
    @IsInt()
    @IsPositive()
    id_dependiente?: number;

    @IsNotEmpty({ message: 'El motivo es obligatorio' })
    @IsString()
    @MaxLength(500)
    motivo!: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notas?: string;
}