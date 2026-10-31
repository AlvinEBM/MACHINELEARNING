// =================================================================
// CAPA: Application / DTOs
// DTO de entrada para POST /auth/login.
//
// Antes era una interface; ahora es una CLASE con decoradores de
// class-validator. Esto permite que el authHandler valide
// automáticamente cada campo antes de llamar al Service.
// =================================================================
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDTO {
    @IsNotEmpty({ message: 'El correo es obligatorio' })
    @IsEmail({}, { message: 'El correo debe tener un formato válido' })
    correo!: string;

    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    @IsString({ message: 'La contraseña debe ser texto' })
    @MaxLength(10, { message: 'La contraseña no puede exceder 10 caracteres' })
    contrasena!: string;
}