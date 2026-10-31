// =================================================================
// CAPA: Infrastructure / Models
// Model TypeORM mapeado a la tabla "documentos".
// =================================================================
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('documentos')
export class DocumentoModel {
    @PrimaryGeneratedColumn()
    id_documento!: number;

    @Column()
    id_paciente!: number;

    @Column({ type: 'int', nullable: true })
    id_dependiente!: number | null;

    @Column({ type: 'enum', enum: ['historia_clinica', 'resultado_laboratorio', 'orden_medica'] })
    tipo_documento!: 'historia_clinica' | 'resultado_laboratorio' | 'orden_medica';

    @Column()
    titulo!: string;

    @Column({ type: 'text' })
    contenido!: string;

    @Column()
    id_medico_tratante!: number;

    @Column({ type: 'timestamp' })
    fecha_creacion!: Date;
}
