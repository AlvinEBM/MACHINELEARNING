// =================================================================
// CAPA: Infrastructure / Mapping
// Traduce entre EspecialidadModel (TypeORM) <-> Especialidad (Domain).
// =================================================================
import { EspecialidadModel } from '../models/especialidad.model';
import { Especialidad } from '../../domain/entities/especialidad.entity';

export class EspecialidadMapping {
    static toDomain(model: EspecialidadModel): Especialidad {
        return new Especialidad(
            model.id_especialidad,
            model.nombre,
            model.descripcion,
            model.estado,
        );
    }
}