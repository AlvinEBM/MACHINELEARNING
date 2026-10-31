// =================================================================
// CAPA: Infrastructure / Repositories
// Implementación CONCRETA del contrato IEspecialidadRepository.
// Aquí es donde realmente se consulta la tabla "especialidades".
// =================================================================
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../../config/datasource';
import { EspecialidadModel } from '../models/especialidad.model';
import { IEspecialidadRepository } from '../../domain/repositories/IEspecialidadRepository';
import { Especialidad } from '../../domain/entities/especialidad.entity';
import { EspecialidadMapping } from '../mapping/especialidad.mapping';

export class EspecialidadRepository implements IEspecialidadRepository {
    private repo: Repository<EspecialidadModel>;

    constructor() {
        this.repo = AppDataSource.getRepository(EspecialidadModel);
    }

    /**
     * Lista solo las especialidades con estado 'ACTIVA'.
     * Es lo que el paciente verá en el dropdown.
     */
    async findActivas(): Promise<Especialidad[]> {
        const models = await this.repo.find({
            where: { estado: 'ACTIVA' },
            order: { nombre: 'ASC' },
        });

        return models.map(m => EspecialidadMapping.toDomain(m));
    }

    /**
     * Busca una especialidad por su ID.
     */
    async findById(id: number): Promise<Especialidad | null> {
        const model = await this.repo.findOne({
            where: { id_especialidad: id },
        });

        if (!model) {
            return null;
        }

        return EspecialidadMapping.toDomain(model);
    }
}