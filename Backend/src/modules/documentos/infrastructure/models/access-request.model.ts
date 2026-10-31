// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "access_requests"
// (solicitudes de autorización excepcional).
// =================================================================
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('access_requests')
export class AccessRequestModel {
    @PrimaryGeneratedColumn()
    id_solicitud!: number;

    @Column()
    id_usuario!: number;

    @Column()
    id_documento!: number;

    @Column({ type: 'text' })
    motivo!: string;

    @Column({ type: 'enum', enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'], default: 'PENDIENTE' })
    estado!: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

    @Column({ type: 'int', nullable: true })
    id_aprobador!: number | null;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    fecha_solicitud!: Date;

    @Column({ type: 'datetime', nullable: true })
    fecha_respuesta!: Date | null;

    @Column({ type: 'datetime', nullable: true })
    fecha_expiracion!: Date | null;
}
