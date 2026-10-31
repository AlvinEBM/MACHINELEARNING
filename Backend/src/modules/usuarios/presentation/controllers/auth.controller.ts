// =================================================================
// CAPA: Presentation / Controllers
// Endpoints de autenticación y registro.
//
// Después del refactor con authHandler:
//   - El DTO llega YA validado en req.dto
//   - El Controller solo orquesta: llama al Service y devuelve.
//
// Una sola "API" para 2 servicios (patrón pedido por el profesor):
//   - AuthService    → login
//   - UserService    → register
// =================================================================
import { Request, Response } from 'express';

import { AuthService } from '../../application/services/auth.service';
import { UserService } from '../../application/services/user.service';
import { LoginDTO } from '../../application/dtos/login.dto';
import { RegisterDTO } from '../../application/dtos/register.dto';

export class AuthController {
    private authService: AuthService;
    private userService: UserService;

    constructor() {
        this.authService = new AuthService();
        this.userService = new UserService();
    }

    // ============================================================
    // POST /auth/login
    // ============================================================
    login = async (req: Request, res: Response) => {
        // El DTO ya viene validado desde el middleware
        const data = req.dto as LoginDTO;

        const result = await this.authService.login(data);

        if (!result) {
            return res.status(401).json({
                ok: false,
                mensaje: 'Credenciales inválidas',
            });
        }

        return res.status(200).json(result);
    };

    // ============================================================
    // POST /auth/register
    // ============================================================
    register = async (req: Request, res: Response) => {
        // El DTO ya viene validado desde el middleware
        const data = req.dto as RegisterDTO;

        const result = await this.userService.register(data);

        if (!result.ok) {
            return res.status(409).json(result);
        }

        return res.status(201).json(result);
    };
}