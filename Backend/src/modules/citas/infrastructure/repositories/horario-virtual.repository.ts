// =================================================================
// CAPA: Infrastructure / Repositories
// Genera horarios "virtuales" al vuelo (Enfoque A).
//
// NO lee la tabla horarios. En su lugar:
//   1. Genera los slots según la configuración (8:00-13:00, etc.)
//   2. Consulta qué médico atiende la especialidad
//   3. Consulta las citas ya reservadas de ese día/médico
//   4. Devuelve solo los slots libres
// =================================================================
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../../config/datasource';
import { CitaModel } from '../models/cita.model';
import { MedicoModel } from '../models/medico.model';
import {
    generarSlotsDelDia,
    fechaEsReservable,
} from '../../domain/horario.config';

export interface SlotDisponible {
    hora: string;            // "08:00:00"
    id_medico: number;
    medico_nombres: string;
    medico_apellidos: string;
    disponible: boolean;     // true = libre, false = ocupado
}

export class HorarioVirtualRepository {
    private citaRepo: Repository<CitaModel>;
    private medicoRepo: Repository<MedicoModel>;

    constructor() {
        this.citaRepo   = AppDataSource.getRepository(CitaModel);
        this.medicoRepo = AppDataSource.getRepository(MedicoModel);
    }

    /**
     * Devuelve los slots de un día para una especialidad,
     * marcando cuáles están ocupados.
     */
    async obtenerSlots(fecha: string, idEspecialidad: number): Promise<{
        ok: boolean;
        motivo?: string;
        medico?: { id_medico: number; nombres: string; apellidos: string };
        slots: SlotDisponible[];
    }> {
        // 1) Validar que la fecha esté dentro de la ventana
        const validez = fechaEsReservable(fecha);
        if (!validez.ok) {
            return { ok: false, motivo: validez.motivo, slots: [] };
        }

        // 2) Buscar el médico de esa especialidad
        const medico = await this.medicoRepo.findOne({
            where: { id_especialidad: idEspecialidad },
        });

        if (!medico) {
            return { ok: false, motivo: 'No hay médico asignado a esta especialidad', slots: [] };
        }

        // 3) Generar todos los slots del día
        const todosLosSlots = generarSlotsDelDia();

        // 4) Consultar citas ya reservadas de ese médico ese día
        //    (unimos citas con horarios reales SOLO para saber cuáles están ocupadas;
        //     pero como ahora generamos virtualmente, comparamos por hora)
        const citasOcupadas = await this.citaRepo
            .createQueryBuilder('c')
            .innerJoin('horarios', 'h', 'h.id_horario = c.id_horario')
            .select('h.hora', 'hora')
            .where('h.fecha = :fecha', { fecha })
            .andWhere('h.id_medico = :idMedico', { idMedico: medico.id_medico })
            .andWhere('c.estado IN (:...estados)', { estados: ['RESERVADA', 'CONFIRMADA', 'RECORDATORIO', 'COMPLETADA'] })
            .getRawMany();

        const horasOcupadas = new Set(citasOcupadas.map(c => String(c.hora)));

        // 5) Construir respuesta
        const slots: SlotDisponible[] = todosLosSlots.map(hora => ({
            hora,
            id_medico: medico.id_medico,
            medico_nombres: medico.nombres,
            medico_apellidos: medico.apellidos,
            disponible: !horasOcupadas.has(hora),
        }));

        return {
            ok: true,
            medico: {
                id_medico: medico.id_medico,
                nombres: medico.nombres,
                apellidos: medico.apellidos,
            },
            slots,
        };
    }

    /**
     * Devuelve el calendario de un mes completo: por cada día laborable
     * dentro de la ventana, cuántos slots hay libres.
     * Sirve para pintar el calendario visual.
     */
    async obtenerCalendario(anio: number, mes: number, idEspecialidad: number): Promise<{
        ok: boolean;
        dias: { fecha: string; total: number; libres: number; reservable: boolean }[];
    }> {
        const medico = await this.medicoRepo.findOne({
            where: { id_especialidad: idEspecialidad },
        });
        if (!medico) {
            return { ok: false, dias: [] };
        }

        const totalSlots = generarSlotsDelDia().length;

        // Recorremos todos los días del mes solicitado
        const diasDelMes = new Date(anio, mes, 0).getDate(); // mes 1-12
        const dias: { fecha: string; total: number; libres: number; reservable: boolean }[] = [];

        for (let d = 1; d <= diasDelMes; d++) {
            const fechaStr = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const validez = fechaEsReservable(fechaStr);

            if (!validez.ok) {
                dias.push({ fecha: fechaStr, total: 0, libres: 0, reservable: false });
                continue;
            }

            // Contar ocupadas ese día
            const ocupadas = await this.citaRepo
                .createQueryBuilder('c')
                .innerJoin('horarios', 'h', 'h.id_horario = c.id_horario')
                .where('h.fecha = :fecha', { fecha: fechaStr })
                .andWhere('h.id_medico = :idMedico', { idMedico: medico.id_medico })
                .andWhere('c.estado IN (:...estados)', { estados: ['RESERVADA', 'CONFIRMADA', 'RECORDATORIO', 'COMPLETADA'] })
                .getCount();

            dias.push({
                fecha: fechaStr,
                total: totalSlots,
                libres: totalSlots - ocupadas,
                reservable: true,
            });
        }

        return { ok: true, dias };
    }
}