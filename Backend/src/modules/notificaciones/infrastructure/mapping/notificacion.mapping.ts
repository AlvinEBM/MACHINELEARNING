// =================================================================
// CAPA: Infrastructure / Mapping
// Traduce entre NotificacionModel (TypeORM) y Notificacion (Domain).
// =================================================================
import { NotificacionModel } from '../models/notificacion.model';
import { Notificacion } from '../../domain/entities/notificacion.entity';

export class NotificacionMapping {
    static toDomain(model: NotificacionModel): Notificacion {
        return new Notificacion(
            model.id_notificacion,
            model.id_cita,
            model.id_usuario,
            model.tipo,
            model.mensaje,
            model.enviado,
            model.leida,
            model.fecha_programada,
        );
    }
}