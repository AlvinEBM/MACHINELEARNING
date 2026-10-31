// =================================================================
// CAPA: Shared / Middlewares
//
// MIDDLEWARE ÚNICO - authHandler
// ─────────────────────────────────────────────────────────────────
// Combina en una SOLA función:
//   1. Autenticación  → valida el JWT y extrae su payload
//   2. Autorización   → verifica que el rol del JWT esté permitido
//   3. Validación DTO → valida el body o query según la clase DTO
//
// El rol viaja DENTRO del JWT (no hace falta consultar la BD).
// Si todo pasa, adjunta al request:
//   - req.jwt     → datos del usuario autenticado (id, rol)
//   - req.dto     → instancia del DTO ya validada
//
// Si alguna verificación falla:
//   - 401 token inválido/ausente
//   - 403 rol no permitido
//   - 400 datos del DTO inválidos
// =================================================================
import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

// ----- Extender el tipo Request de Express para incluir jwt y dto -----
declare global {
    namespace Express {
        interface Request {
            jwt?: {
                id: number;
                rol: 'PACIENTE' | 'ADMIN' | 'ADMISION' | 'MEDICO' | 'ENFERMERIA';
            };
            dto?: any;
        }
    }
}

// ----- Tipos de configuración -----
type Rol = 'PACIENTE' | 'ADMIN' | 'ADMISION' | 'MEDICO' | 'ENFERMERIA';

interface AuthHandlerOptions {
    /** Roles permitidos. Si está vacío, basta con estar autenticado. */
    roles?: Rol[];
    /** Clase DTO para validar el body o el query */
    dto?: any;
    /** Dónde están los datos a validar: 'body' (POST/PUT) o 'query' (GET) */
    source?: 'body' | 'query';
}

/**
 * Genera un middleware que ejecuta TODO el ciclo de seguridad
 * y validación de una petición.
 */
export const authHandler = (opts: AuthHandlerOptions = {}): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // =============================================================
        // 1) AUTENTICACIÓN — Verificar JWT
        // =============================================================
        const header = req.headers.authorization;

        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({
                ok: false,
                mensaje: 'Token no proporcionado',
            });
        }

        const token = header.split(' ')[1];

        let payload: { id: number; rol: Rol };
        try {
            payload = jwt.verify(
                token,
                process.env.JWT_SECRET || 'secret',
            ) as { id: number; rol: Rol };
        } catch (error) {
            return res.status(401).json({
                ok: false,
                mensaje: 'Token inválido o expirado',
            });
        }

        // Adjuntar datos del JWT al request para que el controller los use
        req.jwt = {
            id: payload.id,
            rol: payload.rol,
        };

        // =============================================================
        // 2) AUTORIZACIÓN — Verificar rol (si la ruta lo exige)
        // =============================================================
        if (opts.roles && opts.roles.length > 0) {
            if (!opts.roles.includes(payload.rol)) {
                return res.status(403).json({
                    ok: false,
                    mensaje: 'No tienes permisos para acceder a este recurso',
                });
            }
        }

        // =============================================================
        // 3) VALIDACIÓN DE DTO — (si la ruta lo exige)
        // =============================================================
        if (opts.dto) {
            const source   = opts.source || 'body';
            const rawData  = source === 'query' ? req.query : req.body;

            // Convertir JSON plano a instancia de la clase DTO
            const instance = plainToInstance(opts.dto, rawData, {
                enableImplicitConversion: true,
            });

            // Ejecutar las validaciones de los decoradores
            const errors: ValidationError[] = await validate(instance, {
                whitelist: true,                  // elimina props no declaradas
                forbidNonWhitelisted: false,
                stopAtFirstError: false,
            });

            if (errors.length > 0) {
                // Formatear errores legibles
                const detalle = errors.map(e => ({
                    campo: e.property,
                    errores: Object.values(e.constraints || {}),
                }));

                return res.status(400).json({
                    ok: false,
                    mensaje: 'Datos inválidos',
                    detalle,
                });
            }

            // Adjuntar el DTO validado al request
            req.dto = instance;
        }

        // =============================================================
        // 4) TODO OK — Continuar al controller
        // =============================================================
        next();
    };
};