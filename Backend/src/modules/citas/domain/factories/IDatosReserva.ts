    export interface IDatosReserva {
        id_horario: number;
        id_especialidad: number;
        id_dependiente?: number;
        motivo: string;
        notas?: string;
    }