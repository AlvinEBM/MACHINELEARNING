// =================================================================
// CAPA: Presentation / Controllers
// Endpoints del módulo Documentos médicos.
// El id y el rol del usuario se toman SIEMPRE del JWT.
// =================================================================
import { Request, Response } from 'express';

import { DocumentoService, RolPersonal } from '../../application/services/documento.service';

const responder = (res: Response, result: any, okStatus = 200) => {
    if (result && result.ok === false) {
        return res.status(result.codigo || 400).json(result);
    }
    return res.status(okStatus).json(result);
};

export class DocumentoController {
    private service = new DocumentoService();

    // GET /documentos
    listar = async (_req: Request, res: Response) => {
        return responder(res, await this.service.listar());
    };

    // POST /documentos/:id/acceder
    acceder = async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
        const result = await this.service.acceder(req.jwt!.id, req.jwt!.rol as RolPersonal, id, req.dto?.solicitud_texto);
        return responder(res, result);
    };

    // POST /documentos/chat
    chat = async (req: Request, res: Response) => {
        const result = await this.service.chat(req.jwt!.id, req.jwt!.rol as RolPersonal, req.dto.mensaje);
        return responder(res, result);
    };

    // POST /documentos/:id/solicitar-excepcional
    solicitarExcepcional = async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
        return responder(res, await this.service.solicitarExcepcional(req.jwt!.id, id, req.dto.motivo), 201);
    };

    // GET /documentos/solicitudes/mias
    misSolicitudes = async (req: Request, res: Response) => {
        return responder(res, await this.service.misSolicitudes(req.jwt!.id));
    };

    // GET /documentos/solicitudes?estado=PENDIENTE
    listarSolicitudes = async (req: Request, res: Response) => {
        const estado = req.query.estado as any;
        const valido = ['PENDIENTE', 'APROBADA', 'RECHAZADA'].includes(estado) ? estado : undefined;
        return responder(res, await this.service.listarSolicitudes(valido));
    };

    // PUT /documentos/solicitudes/:id
    responderSolicitud = async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
        return responder(res, await this.service.responderSolicitud(req.jwt!.id, id, req.dto.aprobar));
    };

    // GET /documentos/auditoria?limite=50
    auditoria = async (req: Request, res: Response) => {
        const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 500);
        return responder(res, await this.service.panelAuditoria(limite));
    };

    // PUT /documentos/alertas/:id/revisar
    revisarAlerta = async (req: Request, res: Response) => {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) return res.status(400).json({ ok: false, mensaje: 'ID inválido' });
        return responder(res, await this.service.revisarAlerta(id));
    };

    // GET /documentos/agente/estado
    estadoAgente = async (_req: Request, res: Response) => {
        return responder(res, await this.service.estadoAgente());
    };
}
