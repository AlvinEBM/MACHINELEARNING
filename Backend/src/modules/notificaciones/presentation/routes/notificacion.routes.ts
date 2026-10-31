// =================================================================
// CAPA: Presentation / Routes
// Rutas del módulo Notificaciones.
// Solo PACIENTES pueden ver su propio buzón.
// =================================================================
import { Router } from 'express';

import { NotificacionController } from '../controllers/notificacion.controller';
import { authHandler } from '../../../../shared/middlewares/auth.handler';

const router = Router();
const controller = new NotificacionController();

// GET /notificaciones/buzon
router.get(
    '/buzon',
    authHandler({ roles: ['PACIENTE'] }),
    controller.obtenerBuzon,
);

// PUT /notificaciones/:id/leida
router.put(
    '/:id/leida',
    authHandler({ roles: ['PACIENTE'] }),
    controller.marcarLeida,
);

export default router;