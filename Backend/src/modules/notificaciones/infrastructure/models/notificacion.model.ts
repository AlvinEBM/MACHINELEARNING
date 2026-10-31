// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "notificaciones" en MySQL.
// =================================================================
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from 'typeorm';

@Entity('notificaciones')
export class NotificacionModel {
    @PrimaryGeneratedColumn()
    id_notificacion!: number;

    @Column({ nullable: true })
    id_cita!: number | null;

    @Column()
    id_usuario!: number;

    @Column({ type: 'enum', enum: ['CANCELACION', 'RECORDATORIO'] })
    tipo!: 'CANCELACION' | 'RECORDATORIO';

    @Column({ type: 'text' })
    mensaje!: string;

    @Column({ default: false })
    enviado!: boolean;

    @Column({ default: false })
    leida!: boolean;

    @Column({ type: 'datetime' })
    fecha_programada!: Date;
}