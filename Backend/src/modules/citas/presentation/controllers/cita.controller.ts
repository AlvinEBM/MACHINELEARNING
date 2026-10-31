// =================================================================
// CAPA: Presentation / Controllers
// Endpoints del módulo Citas.
// =================================================================
import { Request, Response } from 'express';

import { CitaService } from '../../application/services/cita.service';
import { ReservarCitaDTO } from '../../application/dto/reservar-cita.dto';

export class CitaController {
    private service: CitaService;

    constructor() {
        this.service = new CitaService();
    }

    // GET /citas/especialidades
    listarEspecialidades = async (_req: Request, res: Response) => {
        const result = await this.service.listarEspecialidades();
        return res.status(200).json(result);
    };

    // GET /citas/horarios?fecha=...&especialidad=...
    listarHorarios = async (req: Request, res: Response) => {
        const fecha          = String(req.query.fecha || '');
        const idEspecialidad = Number(req.query.especialidad || 0);

        if (!fecha || !idEspecialidad) {
            return res.status(400).json({
                ok: false,
                mensaje: 'Debe enviar fecha y especialidad',
            });
        }

        const result = await this.service.listarHorariosDisponibles(fecha, idEspecialidad);
        if (!result.ok) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    };

    // GET /citas/calendario?anio=...&mes=...&especialidad=...
    calendario = async (req: Request, res: Response) => {
        const anio           = Number(req.query.anio || 0);
        const mes            = Number(req.query.mes || 0);
        const idEspecialidad = Number(req.query.especialidad || 0);

        if (!anio || !mes || !idEspecialidad) {
            return res.status(400).json({
                ok: false,
                mensaje: 'Debe enviar anio, mes y especialidad',
            });
        }

        const result = await this.service.obtenerCalendario(anio, mes, idEspecialidad);
        return res.status(200).json(result);
    };

    // POST /citas/reservar
    reservar = async (req: Request, res: Response) => {
        const dto = req.dto as ReservarCitaDTO;
        const idUsuario = req.jwt!.id;

        const result = await this.service.reservarCita(idUsuario, dto);

        if (!result.ok) {
            return res.status(409).json(result);
        }
        return res.status(201).json(result);
    };

    // GET /citas/mis-citas
    misCitas = async (req: Request, res: Response) => {
        const idUsuario = req.jwt!.id;
        const result = await this.service.historialPaciente(idUsuario);
        return res.status(200).json(result);
    };

    // GET /citas/contadores
    contadores = async (req: Request, res: Response) => {
        const idUsuario = req.jwt!.id;
        const result = await this.service.contadoresPaciente(idUsuario);
        return res.status(200).json(result);
    };

    // GET /citas/todas (ADMIN)
    listarTodas = async (_req: Request, res: Response) => {
        const result = await this.service.listarTodas();
        return res.status(200).json(result);
    };
    // PUT /citas/:id/cancelar
    cancelar = async (req: Request, res: Response) => {
        const idCita = Number(req.params.id);
        const idUsuario = req.jwt!.id;

        if (!idCita || isNaN(idCita)) {
            return res.status(400).json({ ok: false, mensaje: 'ID de cita inválido' });
        }

        const result = await this.service.cancelarCita(idUsuario, idCita);

        if (!result.ok) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    };
}