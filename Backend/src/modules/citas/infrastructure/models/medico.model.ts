// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "medicos" en MySQL.
// =================================================================
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from 'typeorm';

@Entity('medicos')
export class MedicoModel {
    @PrimaryGeneratedColumn()
    id_medico!: number;

    @Column()
    nombres!: string;

    @Column()
    apellidos!: string;

    @Column()
    id_especialidad!: number;

    // Vínculo con la cuenta de usuario del médico (agregado por BD_agente_ia.sql)
    @Column({ type: 'int', nullable: true })
    id_usuario!: number | null;
}