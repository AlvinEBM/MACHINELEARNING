// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /admin/usuario-admision.
// =================================================================
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    Length,
    Matches,
    MaxLength,
} from 'class-validator';

export class CrearAdmisionDTO {
    @IsNotEmpty({ message: 'El correo es obligatorio' })
    @IsEmail({}, { message: 'El correo debe tener un formato válido' })
    correo!: string;

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
}