// =================================================================
// CAPA: Presentation / Controllers
// Endpoints del módulo Notificaciones.
// =================================================================
import { Request, Response } from 'express';

import { NotificacionService } from '../../application/services/notificacion.service';

export class NotificacionController {
    private service: NotificacionService;

    constructor() {
        this.service = new NotificacionService();
    }

    // ============================================================
    // GET /notificaciones/buzon
    // El id_usuario se extrae del JWT (no del body, por seguridad)
    // ============================================================
    obtenerBuzon = async (req: Request, res: Response) => {
        const idUsuario = req.jwt!.id;
        const result = await this.service.obtenerBuzon(idUsuario);
        return res.status(200).json(result);
    };

    // ============================================================
    // PUT /notificaciones/:id/leida
    // ============================================================
    marcarLeida = async (req: Request, res: Response) => {
        const idNotificacion = Number(req.params.id);
        const idUsuario = req.jwt!.id;

        if (!idNotificacion || isNaN(idNotificacion)) {
            return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
        }

        const result = await this.service.marcarLeida(idNotificacion, idUsuario);

        if (!result.ok) {
            return res.status(404).json(result);
        }
        return res.status(200).json(result);
    };
}