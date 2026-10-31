// =================================================================
// CAPA: Infrastructure / Mapping
// Traduce entre ConfiguracionModel (TypeORM) y
// Configuracion (Domain).
// =================================================================
import { ConfiguracionModel } from '../models/configuracion.model';
import { Configuracion } from '../../domain/entities/configuracion.entity';

export class ConfiguracionMapping {
    static toDomain(model: ConfiguracionModel): Configuracion {
        return new Configuracion(
            model.id_config,
            model.clave,
            model.valor,
            model.descripcion,
        );
    }
}