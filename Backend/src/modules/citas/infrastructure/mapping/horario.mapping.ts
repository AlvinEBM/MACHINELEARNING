// =================================================================
// CAPA: Infrastructure / Mapping
// Traduce entre HorarioModel (TypeORM) <-> Horario (Domain).
// =================================================================
import { HorarioModel } from '../models/horario.model';
import { Horario } from '../../domain/entities/horario.entity';

export class HorarioMapping {
    static toDomain(model: HorarioModel): Horario {
        return new Horario(
            model.id_horario,
            model.id_medico,
            model.fecha,
            model.hora,
            model.tipo_visita,
            model.disponible,
        );
    }
}