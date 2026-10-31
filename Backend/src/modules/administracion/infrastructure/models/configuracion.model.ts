// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "configuracion_sistema" en MySQL.
// Guarda parámetros clave-valor configurables por el admin.
// =================================================================
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from 'typeorm';

@Entity('configuracion_sistema')
export class ConfiguracionModel {
    @PrimaryGeneratedColumn()
    id_config!: number;

    @Column({ unique: true })
    clave!: string;

    @Column()
    valor!: string;

    @Column({ type: 'text', nullable: true })
    descripcion!: string;
}