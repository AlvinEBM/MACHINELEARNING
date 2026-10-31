// =================================================================
// CAPA: Application / Services
// Lógica de negocio del módulo Citas.
//
// CAMBIO (Enfoque A1 - horarios virtuales):
//   - listarHorariosDisponibles ahora GENERA los slots al vuelo
//     (no lee horarios pre-cargados).
//   - reservarCita recibe fecha+hora, crea el horario en BD en
//     ese momento y luego crea la cita.
// =================================================================
import { IEspecialidadRepository } from '../../domain/repositories/IEspecialidadRepository';
import { IHorarioRepository } from '../../domain/repositories/IHorarioRepository';
import { ICitaRepository } from '../../domain/repositories/ICitaRepository';

import { EspecialidadRepository } from '../../infrastructure/repositories/especialidad.repository';
import { HorarioRepository } from '../../infrastructure/repositories/horario.repository';
import { CitaRepository } from '../../infrastructure/repositories/cita.repository';
import { HorarioVirtualRepository } from '../../infrastructure/repositories/horario-virtual.repository';

import { ReservarCitaDTO } from '../dto/reservar-cita.dto';
import { CitaFactory } from '../../domain/factories/cita.factory';
import { fechaEsReservable } from '../../domain/horario.config';

export class CitaService {
    private especialidadRepo: IEspecialidadRepository = new EspecialidadRepository();
    private horarioRepo: IHorarioRepository           = new HorarioRepository();
    private citaRepo: ICitaRepository                 = new CitaRepository();
    private horarioVirtualRepo                        = new HorarioVirtualRepository();

    // ============================================================
    // 1) Listar especialidades activas
    // ============================================================
    async listarEspecialidades() {
        const especialidades = await this.especialidadRepo.findActivas();
        return { ok: true, especialidades };
    }

    // ============================================================
    // 2) Listar horarios disponibles (GENERADOS AL VUELO)
    // ============================================================
    async listarHorariosDisponibles(fecha: string, idEspecialidad: number) {
        const esp = await this.especialidadRepo.findById(idEspecialidad);
        if (!esp || esp.estado !== 'ACTIVA') {
            return { ok: false, mensaje: 'La especialidad no está disponible' };
        }

        // Genera los slots del día y marca cuáles están ocupados
        const resultado = await this.horarioVirtualRepo.obtenerSlots(fecha, idEspecialidad);

        if (!resultado.ok) {
            return { ok: false, mensaje: resultado.motivo };
        }

        return {
            ok: true,
            medico: resultado.medico,
            horarios: resultado.slots,
        };
    }

    // ============================================================
    // 2b) Calendario del mes (para pintar el calendario visual)
    // ============================================================
    async obtenerCalendario(anio: number, mes: number, idEspecialidad: number) {
        const esp = await this.especialidadRepo.findById(idEspecialidad);
        if (!esp || esp.estado !== 'ACTIVA') {
            return { ok: false, mensaje: 'La especialidad no está disponible', dias: [] };
        }

        const resultado = await this.horarioVirtualRepo.obtenerCalendario(anio, mes, idEspecialidad);
        return {
            ok: resultado.ok,
            dias: resultado.dias,
        };
    }

    // ============================================================
    // 3) Reservar una cita (Enfoque A1)
    //
    //    Flujo:
    //      a) Validar que la fecha esté dentro de la ventana 2 meses
    //      b) Obtener el médico de la especialidad
    //      c) Verificar que el slot no esté ya ocupado
    //      d) Crear el horario en BD (ya ocupado)
    //      e) Crear la cita RESERVADA apuntando a ese horario
    // ============================================================
    async reservarCita(idUsuario: number, data: ReservarCitaDTO) {
        if (!idUsuario || !data.fecha || !data.hora || !data.id_especialidad) {
            return { ok: false, mensaje: 'Faltan datos obligatorios' };
        }

        // a) Validar ventana de reserva
        const validez = fechaEsReservable(data.fecha);
        if (!validez.ok) {
            return { ok: false, mensaje: validez.motivo };
        }

        // b) Obtener médico de la especialidad
        const medico = await this.horarioRepo.obtenerMedicoDeEspecialidad(data.id_especialidad);
        if (!medico) {
            return { ok: false, mensaje: 'No hay médico asignado a esta especialidad' };
        }

        // c) Verificar que el slot no esté ya tomado
        const existente = await this.horarioRepo.findByMedicoFechaHora(
            medico.id_medico,
            data.fecha,
            data.hora,
        );

        if (existente) {
            // El horario ya existe → significa que ya está reservado
            return {
                ok: false,
                mensaje: 'Ese horario ya fue reservado, selecciona otro.',
            };
        }

        // d) Crear el horario en BD (ya ocupado)
        const idHorario = await this.horarioRepo.crearHorario(
            medico.id_medico,
            data.fecha,
            data.hora,
        );

        // e) Crear la cita RESERVADA
        const nueva = CitaFactory.crearReserva(idUsuario, {
            id_horario: idHorario,
            id_especialidad: data.id_especialidad,
            id_dependiente: data.id_dependiente,
            motivo: data.motivo,
            notas: data.notas,
        });

        const guardada = await this.citaRepo.save(nueva);

        return {
            ok: true,
            mensaje: '¡Felicidades, ya tienes tu cita reservada!',
            cita: guardada,
        };
    }

    // ============================================================
    // 4) Historial de citas del paciente
    // ============================================================
// ============================================================
    // 4) Historial de citas del paciente (CON datos enriquecidos)
    // ============================================================
    async historialPaciente(idUsuario: number) {
        const citas = await this.citaRepo.findDetalladasByUsuario(idUsuario);
        return { ok: true, citas };
    }

    // ============================================================
    // 5) Contadores del dashboard
    // ============================================================
    async contadoresPaciente(idUsuario: number) {
        const contadores = await this.citaRepo.contadoresPorUsuario(idUsuario);
        return { ok: true, contadores };
    }

    // ============================================================
    // 6) Todas las citas (ADMIN)
    // ============================================================
    async listarTodas() {
        const citas = await this.citaRepo.listarTodas();
        return { ok: true, total: citas.length, citas };
    }
    // ============================================================
    // 7) Cancelar una cita del paciente
    //    Verifica que la cita le pertenezca al usuario.
    // ============================================================
    async cancelarCita(idUsuario: number, idCita: number) {
        const cita = await this.citaRepo.findById(idCita);

        if (!cita) {
            return { ok: false, mensaje: 'La cita no existe' };
        }

        // Seguridad: solo el dueño puede cancelar su cita
        if (cita.id_usuario !== idUsuario) {
            return { ok: false, mensaje: 'No puedes cancelar una cita que no es tuya' };
        }

        // Solo se pueden cancelar citas activas
        if (!['RESERVADA', 'CONFIRMADA', 'RECORDATORIO'].includes(cita.estado)) {
            return { ok: false, mensaje: `No se puede cancelar una cita en estado ${cita.estado}` };
        }

        await this.citaRepo.cancelar(idCita);

        return { ok: true, mensaje: 'Cita cancelada correctamente', id_cita: idCita };
    }
}