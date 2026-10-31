// =================================================================
// CAPA: Infrastructure / Repositories
// Implementación concreta de IUserRepository usando TypeORM.
//
// Flujo de persistencia:
//   Service (Application) -> IUserRepository (Domain)
//        -> UserRepository (esta clase)
//        -> UserMapping  (transformación)
//        -> UserModel    (TypeORM)
//        -> MySQL
// =================================================================
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../../config/datasource';
import { UserModel } from '../models/user.model';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User } from '../../domain/entities/user.entity';
import { UserMapping } from '../mappings/user.mapping';

export class UserRepository implements IUserRepository {
    private repo: Repository<UserModel>;

    constructor() {
        this.repo = AppDataSource.getRepository(UserModel);
    }

    // Busca por correo y devuelve una entidad pura de Dominio.
    async findByEmail(correo: string): Promise<User | null> {
        const model = await this.repo.findOne({ where: { correo } });
        if (!model) {
            return null;
        }
        return UserMapping.toDomain(model);
    }

    // Devuelve el model crudo (con contraseña). Solo para login.
    async findCredentials(correo: string) {
        return await this.repo.findOne({ where: { correo } });
    }

    // Verifica si el DNI ya está registrado.
    async findByDni(dni: string): Promise<User | null> {
        const model = await this.repo.findOne({ where: { dni } });
        if (!model) {
            return null;
        }
        return UserMapping.toDomain(model);
    }

    // Persiste un nuevo usuario y devuelve la entidad guardada con id.
    async save(user: User): Promise<User> {
        const model = UserMapping.toModel(user);
        const saved = await this.repo.save(model);
        return UserMapping.toDomain(saved);
    }
}