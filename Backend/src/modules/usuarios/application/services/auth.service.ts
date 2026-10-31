// Caso de uso: AUTENTICAR un usuario (login).
//
// Reglas de negocio que orquesta este service:
//   1. Buscar al usuario por correo en la BD.
//   2. Comparar la contraseña ingresada con el hash almacenado.
//   3. Si todo es válido, emitir un token JWT firmado.

// =================================================================
import bcrypt from 'bcrypt';
//import jwt from 'jsonwebtoken';

import { TokenBuilder } from '../../../../shared/builders/token.builder';

import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { LoginDTO } from '../dtos/login.dto';

export class AuthService {

    private repo: IUserRepository = new UserRepository();

    async login(data: LoginDTO) {
       
        // 1) Buscar credenciales por correo
        const user = await this.repo.findCredentials(data.correo);
        console.log('USER:', user);
        if (!user) {
            return null;
        }

        // 2) Comparar contraseña ingresada vs hash en BD
        const valid = await bcrypt.compare(
            data.contrasena,
            user.contrasena,
        );
        console.log('PASSWORD OK:', valid);
        if (!valid) {
            return null;
        }

        // 3) Generar token JWT firmado con la clave secreta
        //    Payload mínimo: id del usuario y su rol.
      const token = new TokenBuilder()
            .conUsuario(user.id_usuario)
            .conRol(user.rol as 'PACIENTE' | 'ADMIN' | 'ADMISION' | 'MEDICO' | 'ENFERMERIA')
            .conExpiracion('1d')
                .firmar();

        // 4) Devolver token + datos básicos al cliente
        return {
            token,
            id_usuario: user.id_usuario,
            correo: user.correo,
            nombres: user.nombres,
            apellidos: user.apellidos,
            rol: user.rol,
        };
    }
}