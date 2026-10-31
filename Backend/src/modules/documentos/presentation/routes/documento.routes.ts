// =================================================================
// CAPA: Presentation / Routes
// Rutas del módulo Documentos médicos.
//
// El personal de salud (MEDICO, ENFERMERIA, ADMISION, ADMIN) puede
// SOLICITAR acceso; quien decide si lo obtiene es el agente de IA.
// Solo el ADMIN aprueba autorizaciones excepcionales y revisa la
// auditoría. Los pacientes no tienen acceso a este módulo.
// =================================================================
import { Router } from 'express';

import { DocumentoController } from '../controllers/documento.controller';
import { authHandler } from '../../../../shared/middlewares/auth.handler';
import { AccederDocumentoDTO } from '../../application/dto/acceder-documento.dto';
import { ChatAgenteDTO } from '../../application/dto/chat-agente.dto';
import { SolicitarExcepcionalDTO } from '../../application/dto/solicitar-excepcional.dto';
import { ResponderSolicitudDTO } from '../../application/dto/responder-solicitud.dto';

const router = Router();
const controller = new DocumentoController();

const PERSONAL: ('MEDICO' | 'ENFERMERIA' | 'ADMISION' | 'ADMIN')[] = ['MEDICO', 'ENFERMERIA', 'ADMISION', 'ADMIN'];

// Listado de documentos (sin contenido clínico)
router.get('/', authHandler({ roles: PERSONAL }), controller.listar);

// Solicitud en lenguaje natural al agente
router.post('/chat', authHandler({ roles: PERSONAL, dto: ChatAgenteDTO }), controller.chat);

// Estado del microservicio del agente
router.get('/agente/estado', authHandler({ roles: PERSONAL }), controller.estadoAgente);

// Autorizaciones excepcionales
router.get('/solicitudes/mias', authHandler({ roles: PERSONAL }), controller.misSolicitudes);
router.get('/solicitudes', authHandler({ roles: ['ADMIN'] }), controller.listarSolicitudes);
router.put('/solicitudes/:id', authHandler({ roles: ['ADMIN'], dto: ResponderSolicitudDTO }), controller.responderSolicitud);

// Auditoría y alertas (solo ADMIN)
router.get('/auditoria', authHandler({ roles: ['ADMIN'] }), controller.auditoria);
router.put('/alertas/:id/revisar', authHandler({ roles: ['ADMIN'] }), controller.revisarAlerta);

// Acceso a un documento: decide el agente
router.post('/:id/acceder', authHandler({ roles: PERSONAL, dto: AccederDocumentoDTO }), controller.acceder);
router.post('/:id/solicitar-excepcional',
    authHandler({ roles: PERSONAL, dto: SolicitarExcepcionalDTO }), controller.solicitarExcepcional);

export default router;
