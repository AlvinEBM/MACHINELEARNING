// =================================================================
// CAPA: Presentation / Routes
// Rutas del módulo Citas, protegidas con el middleware único
// authHandler que combina:
//   - autenticación JWT
//   - autorización por rol (extraído del propio JWT)
//   - validación de DTO (body o query) cuando aplique
//
// Endpoints:
//   GET  /citas/especialidades         → todo usuario autenticado
//   GET  /citas/horarios               → todo usuario autenticado
//   POST /citas/reservar               → solo PACIENTE  + valida DTO
//   GET  /citas/mis-citas              → solo PACIENTE
//   GET  /citas/contadores             → solo PACIENTE
// =================================================================
import { Router } from 'express';

import { CitaController } from '../controllers/cita.controller';
import { authHandler } from '../../../../shared/middlewares/auth.handler';
import { ReservarCitaDTO } from '../../application/dto/reservar-cita.dto';

const router = Router();
const controller = new CitaController();

// ============================================================
// Rutas para CUALQUIER usuario autenticado
// (no se restringe rol, solo se exige JWT válido)
// ============================================================
router.get(
    '/especialidades',
    authHandler(),
    controller.listarEspecialidades,
);

router.get(
    '/horarios',
    authHandler(),
    controller.listarHorarios,
);
router.get(
    '/calendario',
    authHandler(),
    controller.calendario,
);
// ============================================================
// Rutas EXCLUSIVAS del rol PACIENTE
// ============================================================

// Reservar cita: valida el DTO + restringe a PACIENTE
router.post(
    '/reservar',
    authHandler({
        roles: ['PACIENTE'],
        dto: ReservarCitaDTO,
    }),
    controller.reservar,
);

// Ver historial propio: el id se saca del JWT, no de la URL
router.get(
    '/mis-citas',
    authHandler({ roles: ['PACIENTE'] }),
    controller.misCitas,
);

// Ver contadores propios: el id se saca del JWT
router.get(
    '/contadores',
    authHandler({ roles: ['PACIENTE'] }),
    controller.contadores,
);

// Lista todas las citas (solo ADMIN)
router.get(
    '/todas',
    authHandler({ roles: ['ADMIN'] }),
    controller.listarTodas,
);
// PUT /citas/:id/cancelar  (solo PACIENTE, su propia cita)
router.put(
    '/:id/cancelar',
    authHandler({ roles: ['PACIENTE'] }),
    controller.cancelar,
);

export default router;