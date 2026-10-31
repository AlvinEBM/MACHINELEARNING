import { Cita } from '../entities/cita.entity';
import { IDatosReserva } from './IDatosReserva';

export class CitaFactory {

    /**
     * Crea una cita en estado RESERVADA.
     * Es el caso de uso más común: un paciente reserva una cita.
     */
    static crearReserva(idUsuario: number, data: IDatosReserva): Cita {
        return new Cita(
            0,                                  // id_cita lo asigna MySQL
            idUsuario,
            data.id_horario,
            data.id_dependiente ?? null,
            data.motivo ?? null,
            data.notas ?? null,
            'RESERVADA',                        // estado inicial
            new Date(),                         // fecha de registro
        );
    }

    /**
     * Crea una cita ya en estado CANCELADA.
     * Útil para casos administrativos o pruebas internas.
     */
    static crearCancelada(
        idUsuario: number,
        idHorario: number,
        motivo: string,
    ): Cita {
        return new Cita(
            0,
            idUsuario,
            idHorario,
            null,
            motivo,
            'Cancelada al momento de su creación',
            'CANCELADA',
            new Date(),
        );
    }

    /**
     * Crea una cita para un dependiente (hijo/familiar del paciente).
     * Variante específica que obliga a indicar el id_dependiente.
     */
    static crearParaDependiente(
        idUsuario: number,
        idDependiente: number,
        data: Omit<IDatosReserva, 'id_dependiente'>,
    ): Cita {
        return new Cita(
            0,
            idUsuario,
            data.id_horario,
            idDependiente,
            data.motivo,
            data.notas ?? null,
            'RESERVADA',
            new Date(),
        );
    }
}