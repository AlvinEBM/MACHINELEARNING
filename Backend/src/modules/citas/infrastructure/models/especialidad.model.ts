// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "especialidades" en MySQL.
// Solo esta clase conoce los decoradores y la base de datos.
// =================================================================
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from 'typeorm';

@Entity('especialidades')
export class EspecialidadModel {
    @PrimaryGeneratedColumn()
    id_especialidad!: number;

    @Column()
    nombre!: string;

    @Column({ type: 'text', nullable: true })
    descripcion!: string;

    @Column({
        type: 'enum',
        enum: ['ACTIVA', 'INACTIVA'],
        default: 'ACTIVA',
    })
    estado!: 'ACTIVA' | 'INACTIVA';
}