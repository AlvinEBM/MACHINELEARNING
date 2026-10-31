// =================================================================
// CAPA: Presentation / Routes
// Rutas del módulo Asistencias.
//
// Todas las rutas están protegidas con:
//   authHandler({ roles: ['ADMISION', 'ADMIN'] })
//
// El ADMIN también puede acceder (supervisión).
// =================================================================
import { Router } from 'express';

import { AsistenciaController } from '../controllers/asistencia.controller';
import { authHandler } from '../../../../shared/middlewares/auth.handler';

const router = Router();
const controller = new AsistenciaController();

// ============================================================
// GET /admision/citas-hoy
// ============================================================
router.get(
    '/citas-hoy',
    authHandler({ roles: ['ADMISION', 'ADMIN'] }),
    controller.citasDelDia,
);

// ============================================================
// PUT /admision/cita/:id/asistio
// ============================================================
router.put(
    '/cita/:id/asistio',
    authHandler({ roles: ['ADMISION', 'ADMIN'] }),
    controller.marcarAsistencia,
);

// ============================================================
// PUT /admision/cita/:id/falta
// ============================================================
router.put(
    '/cita/:id/falta',
    authHandler({ roles: ['ADMISION', 'ADMIN'] }),
    controller.marcarInasistencia,
);

export default router;