// =================================================================
// CAPA: Presentation / Controllers
// Endpoints del módulo Asistencias para personal de Admisión.
// =================================================================
import { Request, Response } from 'express';

import { AsistenciaService } from '../../application/services/asistencia.service';

export class AsistenciaController {
    private service: AsistenciaService;

    constructor() {
        this.service = new AsistenciaService();
    }

    // ============================================================
    // GET /admision/citas-hoy?fecha=YYYY-MM-DD (fecha opcional)
    // ============================================================
    citasDelDia = async (req: Request, res: Response) => {
        const fecha = req.query.fecha ? String(req.query.fecha) : undefined;
        const result = await this.service.listarCitasDelDia(fecha);
        return res.status(200).json(result);
    };

    // ============================================================
    // PUT /admision/cita/:id/asistio
    // ============================================================
    marcarAsistencia = async (req: Request, res: Response) => {
        const idCita = Number(req.params.id);

        if (!idCita || isNaN(idCita)) {
            return res.status(400).json({ ok: false, mensaje: 'ID de cita inválido' });
        }

        const result = await this.service.marcarAsistencia(idCita);

        if (!result.ok) {
            return res.status(409).json(result);
        }
        return res.status(200).json(result);
    };

    // ============================================================
    // PUT /admision/cita/:id/falta
    // ============================================================
    marcarInasistencia = async (req: Request, res: Response) => {
        const idCita = Number(req.params.id);

        if (!idCita || isNaN(idCita)) {
            return res.status(400).json({ ok: false, mensaje: 'ID de cita inválido' });
        }

        const result = await this.service.marcarInasistencia(idCita);

        if (!result.ok) {
            return res.status(409).json(result);
        }
        return res.status(200).json(result);
    };
}