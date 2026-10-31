// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "citas" en MySQL.
// =================================================================
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('citas')
export class CitaModel {
    @PrimaryGeneratedColumn()
    id_cita!: number;

    @Column()
    id_usuario!: number;

    @Column()
    id_horario!: number;

    @Column({ nullable: true })
    id_dependiente!: number;

    @Column({ type: 'text', nullable: true })
    motivo!: string;

    @Column({ type: 'text', nullable: true })
    notas!: string;

    @Column({
        type: 'enum',
        enum: [
            'RESERVADA',
            'CONFIRMADA',
            'RECORDATORIO',
            'COMPLETADA',
            'CANCELADA',
            'FALTA',
        ],
        default: 'RESERVADA',
    })
    estado!:
        | 'RESERVADA'
        | 'CONFIRMADA'
        | 'RECORDATORIO'
        | 'COMPLETADA'
        | 'CANCELADA'
        | 'FALTA';

    @CreateDateColumn()
    fecha_registro!: Date;
}