// toDomain(model) : convierte lo que sale de MySQL en entidad pura
// toModel(entity) : convierte una entidad pura en model para guardar
// =================================================================
import { UserModel } from '../models/user.model';
import { User } from '../../domain/entities/user.entity';

export class UserMapping {
   
    static toDomain(model: UserModel): User {
        return new User(
            model.id_usuario,
            model.correo,
            model.contrasena,
            model.rol,
            model.dni,
            model.nombres,
            model.apellidos,
            model.telefono,
            model.fecha_nacimiento,
            model.direccion,
            model.genero,
            model.inasistencias,
            model.cuenta_bloqueada,
            model.intentos_fallidos,
            model.activo,
            model.fecha_registro,
        );
    }

 
    static toModel(user: User): UserModel {
        const model = new UserModel();
        model.id_usuario       = user.id_usuario;
        model.correo           = user.correo;
        model.contrasena       = user.contrasena;
        model.rol              = user.rol;
        model.dni              = user.dni!;
        model.nombres          = user.nombres!;
        model.apellidos        = user.apellidos!;
        model.telefono         = user.telefono!;
        model.fecha_nacimiento = user.fecha_nacimiento!;
        model.direccion        = user.direccion!;
        model.genero           = user.genero!;
        model.inasistencias    = user.inasistencias;
        model.cuenta_bloqueada = user.cuenta_bloqueada;
        model.intentos_fallidos = user.intentos_fallidos;
        model.activo           = user.activo;
        return model;
    }
}
