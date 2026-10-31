// =================================================================
// CAPA: Presentation / Controllers
// Endpoints del módulo Administración.
//
// Patrón:
//   - req.dto → DTO ya validado por authHandler
//   - req.jwt → datos del admin autenticado (id, rol)
//
// Cada método delega al AdminService y devuelve la respuesta
// en formato JSON con códigos HTTP semánticos.
// =================================================================
import { Request, Response } from 'express';

import { AdminService } from '../../application/services/admin.service';

import { CancelacionMasivaDTO } from '../../application/dto/cancelacion-masiva.dto';
import { NuevaEspecialidadDTO } from '../../application/dto/nueva-especialidad.dto';
import { InhabilitarEspecialidadDTO } from '../../application/dto/inhabilitar-especialidad.dto';
import { ConfigurarSancionesDTO } from '../../application/dto/configurar-sanciones.dto';
import { CrearAdmisionDTO } from '../../application/dto/crear-admision.dto';

export class AdminController {
    private service: AdminService;

    constructor() {
        this.service = new AdminService();
    }

    // ============================================================
    // POST /admin/cancelacion-masiva
    // ============================================================
    cancelarMasivo = async (req: Request, res: Response) => {
        const dto = req.dto as CancelacionMasivaDTO;
        const adminId = req.jwt!.id;

        const result = await this.service.cancelarMasivo(adminId, dto);

        // 404 si no había citas para cancelar
        if (!result.ok) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    };

    // ============================================================
    // POST /admin/especialidad
    // ============================================================
    crearEspecialidad = async (req: Request, res: Response) => {
        const dto = req.dto as NuevaEspecialidadDTO;

        const result = await this.service.crearEspecialidad(dto);

        if (!result.ok) {
            return res.status(409).json(result);
        }
        return res.status(201).json(result);
    };

    // ============================================================
    // PUT /admin/especialidad/inhabilitar
    // ============================================================
    inhabilitarEspecialidad = async (req: Request, res: Response) => {
        const dto = req.dto as InhabilitarEspecialidadDTO;
        const adminId = req.jwt!.id;

        const result = await this.service.inhabilitarEspecialidad(adminId, dto);

        if (!result.ok) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    };

    // ============================================================
    // GET /admin/sanciones
    // ============================================================
    obtenerSanciones = async (_req: Request, res: Response) => {
        const result = await this.service.obtenerSanciones();
        return res.status(200).json(result);
    };

    // ============================================================
    // PUT /admin/sanciones
    // ============================================================
    configurarSanciones = async (req: Request, res: Response) => {
        const dto = req.dto as ConfigurarSancionesDTO;

        const result = await this.service.configurarSanciones(dto);
        return res.status(200).json(result);
    };

    // ============================================================
    // POST /admin/usuario-admision
    // ============================================================
    crearUsuarioAdmision = async (req: Request, res: Response) => {
        const dto = req.dto as CrearAdmisionDTO;

        const result = await this.service.crearUsuarioAdmision(dto);

        if (!result.ok) {
            return res.status(409).json(result);
        }
        return res.status(201).json(result);
    };
}