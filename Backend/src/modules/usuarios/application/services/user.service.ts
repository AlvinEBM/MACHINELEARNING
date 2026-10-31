// Caso de uso: REGISTRAR un nuevo paciente en el sistema.
//   1. Verificar que el correo no esté ya registrado.
//   2. Verificar que el DNI no esté ya registrado.
//   3. Hashear la contraseña antes de guardarla.
//   4. Crear la Entidad pura User y entregársela al Repository.
//
// El Service no conoce TypeORM ni HTTP. Solo trabaja con la
// interfaz IUserRepository y la entidad User del Domain.
// =================================================================
import bcrypt from 'bcrypt';

import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { RegisterDTO } from '../dtos/register.dto';
import { UsuarioFactory } from '../../domain/factories/usuario.factory';

export class UserService {

    private repo: IUserRepository = new UserRepository();

    async register(data: RegisterDTO) {
        
        // 1) Validación: correo único
        const existeCorreo = await this.repo.findByEmail(data.correo);

        if (existeCorreo) {
            return {
                ok: false,
                mensaje: 'El correo ya está registrado',
            };
        }

        // 2) Validación: DNI único
        const existeDni = await this.repo.findByDni(data.dni);

        if (existeDni) {
            return {
                ok: false,
                mensaje: 'El DNI ya está registrado',
            };
        }

        // 3) Hashear contraseña (nunca se guarda en texto plano)
       const hash = await bcrypt.hash(data.contrasena, 10);

// Patrón Abstract Factory: el factory garantiza que el usuario
// se crea siempre con rol PACIENTE y todos los datos correctos.
        const nuevo = UsuarioFactory.crearPaciente({
            correo: data.correo,
            contrasenaHash: hash,
            dni: data.dni,
            nombres: data.nombres,
            apellidos: data.apellidos,
            telefono: data.telefono,
            genero: data.genero,
            direccion: data.direccion,
            fecha_nacimiento: data.fecha_nacimiento,
        });

        // 5) Persistir mediante el Repository (Infrastructure)
        const guardado = await this.repo.save(nuevo);

        return {
            ok: true,
            mensaje: 'Cuenta creada exitosamente',
            usuario: {
                id_usuario: guardado.id_usuario,
                correo: guardado.correo,
                nombres: guardado.nombres,
                apellidos: guardado.apellidos,
                rol: guardado.rol,
            },
        };
    }
}