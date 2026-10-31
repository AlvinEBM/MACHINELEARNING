import { User } from '../entities/user.entity';

// ----- Interfaces de entrada por tipo de usuario -----

interface DatosPaciente {
    correo: string;
    contrasenaHash: string;
    dni: string;
    nombres: string;
    apellidos: string;
    telefono: string;
    genero: 'Masculino' | 'Femenino' | 'Otros';
    direccion?: string;
    fecha_nacimiento?: string;
}

interface DatosAdmision {
    correo: string;
    contrasenaHash: string;
    dni: string;
    nombres: string;
    apellidos: string;
    telefono: string;
}

interface DatosAdmin {
    correo: string;
    contrasenaHash: string;
    dni: string;
    nombres: string;
    apellidos: string;
}

interface DatosMedico {
    correo: string;
    contrasenaHash: string;
    dni: string;
    nombres: string;
    apellidos: string;
    telefono: string;
    id_especialidad: number;
}

export class UsuarioFactory {

    /**
     * Crea un usuario con rol PACIENTE.
     * Único tipo creable desde el endpoint público /auth/register.
     */
    static crearPaciente(data: DatosPaciente): User {
        return new User(
            0,                                                  // id_usuario (lo asigna MySQL)
            data.correo,
            data.contrasenaHash,
            'PACIENTE',                                          // rol forzado
            data.dni,
            data.nombres,
            data.apellidos,
            data.telefono,
            data.fecha_nacimiento ? new Date(data.fecha_nacimiento) : null,
            data.direccion ?? null,
            data.genero,
            0,                                                  // inasistencias
            false,                                              // cuenta_bloqueada
            0,                                                  // intentos_fallidos
            true,                                               // activo
            new Date(),                                         // fecha_registro
        );
    }

    /**
     * Crea un usuario con rol ADMISION.
     * Solo creable por el administrador desde /admin/usuario-admision.
     */
    static crearAdmision(data: DatosAdmision): User {
        return new User(
            0,
            data.correo,
            data.contrasenaHash,
            'ADMISION',                                          // rol forzado
            data.dni,
            data.nombres,
            data.apellidos,
            data.telefono,
            null,                                                // fecha_nacimiento (no aplica)
            null,                                                // direccion (no aplica)
            null,                                                // genero (no aplica)
            0,
            false,
            0,
            true,
            new Date(),
        );
    }

    /**
     * Crea un usuario con rol ADMIN.
     * Útil para seeds o migraciones internas.
     */
    static crearAdmin(data: DatosAdmin): User {
        return new User(
            0,
            data.correo,
            data.contrasenaHash,
            'ADMIN',                                             // rol forzado
            data.dni,
            data.nombres,
            data.apellidos,
            null,                                                // telefono (no aplica)
            null,                                                // fecha_nacimiento
            null,                                                // direccion
            null,                                                // genero
            0,
            false,
            0,
            true,
            new Date(),
        );
    }

    /**
     * Crea un usuario con rol MEDICO.
     * Requiere especialidad obligatoria (diferente a los demás roles).
     */
    static crearMedico(data: DatosMedico): User {
        return new User(
            0,
            data.correo,
            data.contrasenaHash,
            'MEDICO',                                            // rol forzado
            data.dni,
            data.nombres,
            data.apellidos,
            data.telefono,
            null,                                                // fecha_nacimiento
            null,                                                // direccion
            null,                                                // genero
            0,
            false,
            0,
            true,
            new Date(),
        );
    }
}