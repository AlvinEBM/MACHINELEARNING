// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "fechas_bloqueadas" en MySQL.
// Registra los días bloqueados por cancelaciones masivas o
// inhabilitaciones de especialidad.
// =================================================================
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('fechas_bloqueadas')
export class FechaBloqueadaModel {
    @PrimaryGeneratedColumn()
    id_bloqueo!: number;

    @Column({ type: 'date' })
    fecha!: Date;

    @Column({ nullable: true })
    id_especialidad!: number;

    @Column({ nullable: true })
    motivo!: string;

    @Column()
    creado_por!: number;

    @CreateDateColumn()
    fecha_registro!: Date;
}