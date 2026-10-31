// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para PUT /admin/sanciones.
// =================================================================
import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class ConfigurarSancionesDTO {
    @IsNotEmpty({ message: 'limite_inasistencias es obligatorio' })
    @IsInt({ message: 'limite_inasistencias debe ser un entero' })
    @Min(3, { message: 'El límite mínimo es 3 inasistencias' })
    @Max(10, { message: 'El límite máximo es 10 inasistencias' })
    limite_inasistencias!: number;

    @IsNotEmpty({ message: 'dias_suspension es obligatorio' })
    @IsInt({ message: 'dias_suspension debe ser un entero' })
    @Min(1, { message: 'La suspensión mínima es de 1 día' })
    @Max(30, { message: 'La suspensión máxima es de 30 días' })
    dias_suspension!: number;
}