// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "horarios" en MySQL.
// =================================================================
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from 'typeorm';

@Entity('horarios')
export class HorarioModel {
    @PrimaryGeneratedColumn()
    id_horario!: number;

    @Column()
    id_medico!: number;

    @Column({ type: 'date' })
    fecha!: Date;

    @Column({ type: 'time' })
    hora!: string;

    @Column({
        type: 'enum',
        enum: ['PRESENCIAL', 'VIRTUAL'],
        default: 'PRESENCIAL',
    })
    tipo_visita!: 'PRESENCIAL' | 'VIRTUAL';

    @Column({ default: true })
    disponible!: boolean;
}