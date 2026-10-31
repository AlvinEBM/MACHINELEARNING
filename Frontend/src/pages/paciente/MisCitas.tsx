// =================================================================
// Mis Citas — Lista completa de citas del paciente con filtros.
// =================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Header } from '../../components/layout/Header';
import { Card } from '../../components/common/Card';
import { Boton } from '../../components/common/Boton';
import { BadgeEstadoCita } from '../../components/common/Badge';

import { citasApi } from '../../api/citasApi';
import { CitaConDetalles, EstadoCita } from '../../types';
import { formatearFecha, formatearHora, diasDesdeHoy } from '../../utils/formatters';

type Filtro = 'TODAS' | EstadoCita;

export const MisCitas = () => {
    const navigate = useNavigate();
    const [citas, setCitas]       = useState<CitaConDetalles[]>([]);
    const [filtro, setFiltro]     = useState<Filtro>('TODAS');
    const [cargando, setCargando] = useState(true);
    const [cancelandoId, setCancelandoId] = useState<number | null>(null);

    const cargar = async () => {
        try {
            const data = await citasApi.misCitas();
            setCitas(data);
        } catch (e) {
            console.error('Error cargando citas:', e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const handleCancelar = async (idCita: number) => {
        const confirmar = window.confirm('¿Seguro que deseas cancelar esta cita?');
        if (!confirmar) return;

        setCancelandoId(idCita);
        try {
            const res = await citasApi.cancelar(idCita);
            if (res.ok) {
                await cargar();
            } else {
                alert(res.mensaje);
            }
        } catch {
            alert('No se pudo cancelar la cita');
        } finally {
            setCancelandoId(null);
        }
    };

    const filtradas = filtro === 'TODAS' ? citas : citas.filter(c => c.estado === filtro);

    const filtros: { id: Filtro; label: string }[] = [
        { id: 'TODAS', label: 'Todas' },
        { id: 'RESERVADA', label: 'Próximas' },
        { id: 'COMPLETADA', label: 'Completadas' },
        { id: 'FALTA', label: 'Faltas' },
        { id: 'CANCELADA', label: 'Canceladas' },
    ];

    const esCancelable = (estado: EstadoCita) =>
        ['RESERVADA', 'CONFIRMADA', 'RECORDATORIO'].includes(estado);

    return (
        <div className="min-h-screen bg-smoke">
            <Header />

            <main className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-ink">Mis citas</h1>
                        <p className="text-sm text-mute mt-1">Historial completo de tus citas médicas</p>
                    </div>
                    <Boton onClick={() => navigate('/paciente/reservar')}>+ Nueva cita</Boton>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    {filtros.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFiltro(f.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all
                                ${filtro === f.id ? 'bg-sky-main text-white shadow-card' : 'bg-white text-mute hover:bg-sky-soft hover:text-sky-deep'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {cargando && (
                    <Card className="p-8 text-center"><p className="text-mute text-sm">Cargando tus citas...</p></Card>
                )}

                {!cargando && filtradas.length === 0 && (
                    <Card className="p-12 text-center">
                        <p className="text-mute text-sm mb-4">
                            No tienes citas {filtro !== 'TODAS' ? 'en esta categoría' : 'registradas'}
                        </p>
                        <Boton onClick={() => navigate('/paciente/reservar')}>Agendar mi primera cita</Boton>
                    </Card>
                )}

                {!cargando && filtradas.length > 0 && (
                    <div className="space-y-3">
                        {filtradas.map(cita => (
                            <Card
                                key={cita.id_cita}
                                bordeLateral={
                                    cita.estado === 'COMPLETADA' ? 'success' :
                                    cita.estado === 'FALTA' || cita.estado === 'CANCELADA' ? 'danger' : 'sky'
                                }
                                className="p-5"
                            >
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-ink text-base">
                                                {cita.especialidad ?? 'Especialidad'}
                                            </h3>
                                            <BadgeEstadoCita estado={cita.estado} />
                                        </div>
                                        {cita.medico_nombres && (
                                            <p className="text-sm text-mute">
                                                Dr. {cita.medico_nombres} {cita.medico_apellidos}
                                            </p>
                                        )}
                                    </div>

                                    <div className="text-right min-w-[160px]">
                                        <p className="text-sm font-bold text-ink-soft">
                                            {formatearFecha(cita.fecha ?? '')}
                                        </p>
                                        <p className="text-xs text-mute">
                                            {formatearHora(cita.hora ?? '')}
                                            {esCancelable(cita.estado) && cita.fecha && (
                                                <span className="ml-2 text-sky-main font-bold">
                                                    · {diasDesdeHoy(cita.fecha)}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {cita.motivo && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <p className="text-xs text-mute">
                                            <span className="font-bold">Motivo:</span> {cita.motivo}
                                        </p>
                                    </div>
                                )}

                                {/* Botón cancelar solo en citas activas */}
                                {esCancelable(cita.estado) && (
                                    <div className="mt-3 flex justify-end">
                                        <Boton
                                            variante="danger"
                                            tamano="sm"
                                            disabled={cancelandoId === cita.id_cita}
                                            onClick={() => handleCancelar(cita.id_cita)}
                                        >
                                            {cancelandoId === cita.id_cita ? 'Cancelando...' : 'Cancelar cita'}
                                        </Boton>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};