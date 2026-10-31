// =================================================================
// CAPA: Infrastructure / Mapping
// Traduce entre CitaModel (TypeORM) <-> Cita (Domain).
// =================================================================
import { CitaModel } from '../models/cita.model';
import { Cita } from '../../domain/entities/cita.entity';

export class CitaMapping {
    /**
     * De Model (TypeORM) a Entidad pura (Domain).
     * Se usa al leer citas desde la BD.
     */
    static toDomain(model: CitaModel): Cita {
        return new Cita(
            model.id_cita,
            model.id_usuario,
            model.id_horario,
            model.id_dependiente ?? null,
            model.motivo ?? null,
            model.notas ?? null,
            model.estado,
            model.fecha_registro,
        );
    }

    /**
     * De Entidad pura (Domain) a Model (TypeORM).
     * Se usa al persistir una nueva cita.
     */
    static toModel(cita: Cita): CitaModel {
        const model = new CitaModel();
        model.id_cita        = cita.id_cita;
        model.id_usuario     = cita.id_usuario;
        model.id_horario     = cita.id_horario;
        model.id_dependiente = cita.id_dependiente ?? null as any;
        model.motivo         = cita.motivo!;
        model.notas          = cita.notas!;
        model.estado         = cita.estado;
        model.fecha_registro = cita.fecha_registro;
        return model;
    }
}