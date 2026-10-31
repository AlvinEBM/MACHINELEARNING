// =================================================================
// CAPA: Presentation / Routes
// Rutas del módulo Administración.
//
// TODAS las rutas están protegidas con:
//   authHandler({ roles: ['ADMIN'], dto: ... })
//
// Esto garantiza que solo un usuario autenticado con rol ADMIN
// puede ejecutar acciones administrativas, y que cada DTO está
// validado antes de llegar al controller.
// =================================================================
import { Router } from 'express';

import { AdminController } from '../controllers/admin.controller';
import { authHandler } from '../../../../shared/middlewares/auth.handler';

import { CancelacionMasivaDTO } from '../../application/dto/cancelacion-masiva.dto';
import { NuevaEspecialidadDTO } from '../../application/dto/nueva-especialidad.dto';
import { InhabilitarEspecialidadDTO } from '../../application/dto/inhabilitar-especialidad.dto';
import { ConfigurarSancionesDTO } from '../../application/dto/configurar-sanciones.dto';
import { CrearAdmisionDTO } from '../../application/dto/crear-admision.dto';

const router = Router();
const controller = new AdminController();

// ============================================================
// 1) Cancelación masiva de citas
//    POST /admin/cancelacion-masiva
// ============================================================
router.post(
    '/cancelacion-masiva',
    authHandler({
        roles: ['ADMIN'],
        dto: CancelacionMasivaDTO,
    }),
    controller.cancelarMasivo,
);

// ============================================================
// 2) Crear nueva especialidad
//    POST /admin/especialidad
// ============================================================
router.post(
    '/especialidad',
    authHandler({
        roles: ['ADMIN'],
        dto: NuevaEspecialidadDTO,
    }),
    controller.crearEspecialidad,
);

// ============================================================
// 3) Inhabilitar especialidad temporalmente
//    PUT /admin/especialidad/inhabilitar
// ============================================================
router.put(
    '/especialidad/inhabilitar',
    authHandler({
        roles: ['ADMIN'],
        dto: InhabilitarEspecialidadDTO,
    }),
    controller.inhabilitarEspecialidad,
);

// ============================================================
// 4) Configuración de sanciones
//    GET  /admin/sanciones    (consultar configuración actual)
//    PUT  /admin/sanciones    (actualizar)
// ============================================================
router.get(
    '/sanciones',
    authHandler({ roles: ['ADMIN'] }),
    controller.obtenerSanciones,
);

router.put(
    '/sanciones',
    authHandler({
        roles: ['ADMIN'],
        dto: ConfigurarSancionesDTO,
    }),
    controller.configurarSanciones,
);

// ============================================================
// 5) Crear cuenta de personal de admisión
//    POST /admin/usuario-admision
// ============================================================
router.post(
    '/usuario-admision',
    authHandler({
        roles: ['ADMIN'],
        dto: CrearAdmisionDTO,
    }),
    controller.crearUsuarioAdmision,
);

export default router;