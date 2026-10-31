import { User } from '../entities/user.entity';

export interface IUserRepository {
    /*Busca un usuario por su correo electrónico.*/
    findByEmail(correo: string): Promise<User | null>;

    /*retorna el model con la contraseña hasheada.*/
    findCredentials(correo: string): Promise<any>;

    /* Verifica si ya existe un usuario con ese DNI.  */
    findByDni(dni: string): Promise<User | null>;

    /** Retorna el usuario guardado con su id_usuario asignado.*/
    save(user: User): Promise<User>;
}