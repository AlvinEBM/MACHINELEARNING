import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('usuarios')
export class UserModel {
    @PrimaryGeneratedColumn()
    id_usuario!: number;

    @Column()
    correo!: string;

    @Column()
    contrasena!: string;

    @Column({
        type: 'enum',
        enum: ['PACIENTE', 'ADMIN', 'ADMISION', 'MEDICO', 'ENFERMERIA'],
    })
    rol!: 'PACIENTE' | 'ADMIN' | 'ADMISION' | 'MEDICO' | 'ENFERMERIA';


    @Column({ nullable: true })
    dni!: string;

    @Column({ nullable: true })
    nombres!: string;

    @Column({ nullable: true })
    apellidos!: string;

    @Column({ nullable: true })
    telefono!: string;

    @Column({ type: 'date', nullable: true })
    fecha_nacimiento!: Date;

    @Column({ nullable: true })
    direccion!: string;

    @Column({
        type: 'enum',
        enum: ['Masculino', 'Femenino', 'Otros'],
        nullable: true,
    })
    genero!: 'Masculino' | 'Femenino' | 'Otros';

    // ----- Estado del paciente -----
    @Column({ default: 0 })
    inasistencias!: number;

    @Column({ default: false })
    cuenta_bloqueada!: boolean;

    // ----- Control de acceso -----
    @Column({ default: 0 })
    intentos_fallidos!: number;

    @Column({ default: true })
    activo!: boolean;

    @CreateDateColumn()
    fecha_registro!: Date;
}