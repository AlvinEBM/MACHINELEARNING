// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /auth/register.
//
// Define los campos obligatorios y opcionales para registrar
// un nuevo paciente, con sus reglas de validación.
// =================================================================
import {
    IsEmail,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    MaxLength,
    Matches,
} from 'class-validator';

export class RegisterDTO {
    @IsNotEmpty({ message: 'El correo es obligatorio' })
    @IsEmail({}, { message: 'El correo debe tener un formato válido' })
    correo!: string;

    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    @IsString()
    @MaxLength(10, { message: 'La contraseña no puede exceder 10 caracteres' })
    contrasena!: string;

    @IsNotEmpty({ message: 'El DNI es obligatorio' })
    @Length(8, 8, { message: 'El DNI debe tener exactamente 8 dígitos' })
    @Matches(/^\d+$/, { message: 'El DNI debe contener solo números' })
    dni!: string;

    @IsNotEmpty({ message: 'Los nombres son obligatorios' })
    @IsString()
    @MaxLength(100)
    nombres!: string;

    @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
    @IsString()
    @MaxLength(100)
    apellidos!: string;

    @IsNotEmpty({ message: 'El teléfono es obligatorio' })
    @IsString()
    @MaxLength(20)
    telefono!: string;

    @IsNotEmpty({ message: 'El género es obligatorio' })
    @IsIn(['Masculino', 'Femenino', 'Otros'], {
        message: 'Género debe ser Masculino, Femenino u Otros',
    })
    genero!: 'Masculino' | 'Femenino' | 'Otros';

    @IsOptional()
    @IsString()
    @MaxLength(200)
    direccion?: string;

    @IsOptional()
    @IsString()
    fecha_nacimiento?: string;
}