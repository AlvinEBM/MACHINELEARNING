import jwt from 'jsonwebtoken';

type Rol = 'PACIENTE' | 'ADMIN' | 'ADMISION' | 'MEDICO' | 'ENFERMERIA';

interface PayloadJWT {
    id?: number;
    rol?: Rol;
    correo?: string;
    [key: string]: any;
}

export class TokenBuilder {
    private payload: PayloadJWT = {};
    private expiracion: string = '1d';

    conUsuario(idUsuario: number): TokenBuilder {
        this.payload.id = idUsuario;
        return this;
    }

    conRol(rol: Rol): TokenBuilder {
        this.payload.rol = rol;
        return this;
    }

    conCorreo(correo: string): TokenBuilder {
        this.payload.correo = correo;
        return this;
    }

    conExpiracion(tiempo: string): TokenBuilder {
        this.expiracion = tiempo;
        return this;
    }

    firmar(): string {
        const secret = process.env.JWT_SECRET || 'secret';
        return jwt.sign(this.payload, secret, {
            expiresIn: this.expiracion,
        } as jwt.SignOptions);
    }
}