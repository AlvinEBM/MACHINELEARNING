// =================================================================
// CAPA: Presentation / Routes
// Rutas del módulo Usuarios.
//
// Aplican el middleware único authHandler con la configuración
// específica de cada endpoint.
//
// Endpoints expuestos:
//   POST /auth/login     → valida LoginDTO, sin requerir token
//   POST /auth/register  → valida RegisterDTO, sin requerir token
// =================================================================
import { Router } from 'express';

import { AuthController } from '../controllers/auth.controller';
import { LoginDTO } from '../../application/dtos/login.dto';
import { RegisterDTO } from '../../application/dtos/register.dto';

// Pequeño helper para login y register (no requieren JWT,
// solo validación del DTO). Se hace un wrapper sin token.
import { Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const router = Router();
const controller = new AuthController();

/**
 * Middleware ligero SOLO para validar el body con un DTO
 * (cuando NO se necesita autenticación, como en login/register).
 * Adjunta el DTO validado a req.dto y deja pasar.
 */
const validateBody = (dtoClass: any) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const instance = plainToInstance(dtoClass, req.body, {
            enableImplicitConversion: true,
        });

        const errors = await validate(instance, { whitelist: true });

        if (errors.length > 0) {
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

        req.dto = instance;
        next();
    };
};

// ============================================================
// POST /auth/login
// ============================================================
router.post('/login', validateBody(LoginDTO), controller.login);

// ============================================================
// POST /auth/register
// ============================================================
router.post('/register', validateBody(RegisterDTO), controller.register);

export default router;