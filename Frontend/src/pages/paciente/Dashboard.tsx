// =================================================================
// Dashboard del Paciente.
// =================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Header } from '../../components/layout/Header';
import { Boton } from '../../components/common/Boton';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';

import { useAuth } from '../../auth/useAuth';
import { citasApi } from '../../api/citasApi';
import { CitaConDetalles } from '../../types';
import {
    formatearFecha,
    formatearHora,
    diasDesdeHoy,
    obtenerIniciales,
} from '../../utils/formatters';

export const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [proximaCita, setProximaCita] = useState<CitaConDetalles | null>(null);
    const [cargando, setCargando]       = useState(true);
    const [cancelando, setCancelando]   = useState(false);

    const cargarCitas = async () => {
        try {
            const citas = await citasApi.misCitas();
            const futuras = citas
                .filter(c => c.estado === 'RESERVADA' || c.estado === 'CONFIRMADA' || c.estado === 'RECORDATORIO')
                .sort((a, b) => {
                    const fa = new Date(`${a.fecha}T${a.hora}`).getTime();
                    const fb = new Date(`${b.fecha}T${b.hora}`).getTime();
                    return fa - fb;
                });
            setProximaCita(futuras[0] ?? null);
        } catch (e) {
            console.error('Error cargando citas:', e);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarCitas();
    }, []);

    const handleCancelar = async () => {
        if (!proximaCita) return;
        const confirmar = window.confirm('¿Seguro que deseas cancelar esta cita?');
        if (!confirmar) return;

        setCancelando(true);
        try {
            const res = await citasApi.cancelar(proximaCita.id_cita);
            if (res.ok) {
                await cargarCitas();
            } else {
                alert(res.mensaje);
            }
        } catch {
            alert('No se pudo cancelar la cita');
        } finally {
            setCancelando(false);
        }
    };

    const hoy = new Date().toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    return (
        <div className="min-h-screen bg-smoke">
            <Header />

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Saludo */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-ink">
                        ¡Hola, {user?.nombres}! <span>👋</span>
                    </h1>
                    <p className="text-sm text-mute mt-1">
                        Cuidamos tu salud, hoy es <span className="text-blue-deep font-bold capitalize">{hoy}</span>
                    </p>
                </div>

                {/* ===== BLOQUE PROTAGONISTA ===== */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-bright via-sky-main to-sky-deep p-10 md:p-12 shadow-cta mb-8">
                    <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white opacity-10 -mr-20 -mt-20" />
                    <div className="absolute bottom-0 right-32 w-40 h-40 rounded-full bg-white opacity-5" />
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white opacity-10" />

                    <div className="relative z-10 max-w-3xl">
                        <p className="text-xs font-bold text-white opacity-90 tracking-[0.3em] mb-4">
                            RESERVA TU CITA EN SEGUNDOS
                        </p>
                        <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-3">
                            ¿Necesitas atención<br />médica?
                        </h2>
                        <p className="text-base text-white opacity-95 mb-8">
                            Agenda con el especialista que necesites, disponible 24/7
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => navigate('/paciente/reservar')}
                                className="inline-flex items-center gap-2 px-7 py-4 bg-white hover:bg-smoke rounded-xl shadow-lg font-extrabold text-sky-deep transition-all"
                            >
                                <span className="text-xl">+</span>
                                <span>Agendar nueva cita</span>
                                <span>→</span>
                            </button>
                            <span className="inline-flex items-center gap-1 px-4 py-2 bg-white/15 backdrop-blur rounded-full text-white text-xs font-semibold">
                                ⚡ En 1 minuto
                            </span>
                            <span className="inline-flex items-center gap-1 px-4 py-2 bg-white/15 backdrop-blur rounded-full text-white text-xs font-semibold">
                                📋 Múltiples especialidades
                            </span>
                        </div>
                    </div>
                </div>

                {/* ===== PRÓXIMA CITA ===== */}
                {!cargando && (
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xs font-bold text-sky-deep tracking-widest">
                                ⏰ PRÓXIMA CITA
                            </h3>
                            {proximaCita && proximaCita.fecha && (
                                <Badge variante="success" conPunto>
                                    {diasDesdeHoy(proximaCita.fecha).toUpperCase()}
                                </Badge>
                            )}
                        </div>

                        {proximaCita ? (
                            <Card bordeLateral="sky" className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                    {/* IZQUIERDA */}
                                    <div className="md:col-span-4">
                                        <h4 className="text-xl font-extrabold text-blue-deep mb-3">
                                            {proximaCita.especialidad ?? 'Especialidad'}
                                        </h4>

                                        {proximaCita.medico_nombres && (
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-7 h-7 rounded-full bg-sky-soft flex items-center justify-center text-[11px] font-bold text-sky-deep">
                                                    {obtenerIniciales(proximaCita.medico_nombres, proximaCita.medico_apellidos ?? '')}
                                                </div>
                                                <p className="text-sm font-semibold text-ink-soft">
                                                    Dr. {proximaCita.medico_nombres} {proximaCita.medico_apellidos}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-soft rounded-full text-xs font-bold text-sky-deep">
                                                📅 {formatearFecha(proximaCita.fecha ?? '')}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-soft rounded-full text-xs font-bold text-sky-deep">
                                                ⏰ {formatearHora(proximaCita.hora ?? '')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CENTRO: timeline */}
                                    <div className="md:col-span-5 md:border-l md:border-r md:border-gray-100 md:px-6">
                                        <p className="text-[10px] font-bold text-mute tracking-widest mb-5">
                                            ESTADO DEL PROCESO
                                        </p>
                                        <Timeline />
                                    </div>

                                    {/* DERECHA */}
                                    <div className="md:col-span-3 space-y-2">
                                        <Boton fullWidth onClick={() => navigate('/paciente/mis-citas')}>
                                            Ver detalle →
                                        </Boton>
                                        <Boton
                                            fullWidth
                                            variante="danger"
                                            disabled={cancelando}
                                            onClick={handleCancelar}
                                        >
                                            {cancelando ? 'Cancelando...' : 'Cancelar cita'}
                                        </Boton>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="p-8 text-center">
                                <p className="text-mute text-sm mb-4">No tienes citas próximas</p>
                                <Boton onClick={() => navigate('/paciente/reservar')}>
                                    Agendar mi primera cita
                                </Boton>
                            </Card>
                        )}
                    </div>
                )}

                {cargando && (
                    <Card className="p-8 text-center">
                        <p className="text-mute text-sm">Cargando tu información...</p>
                    </Card>
                )}
            </main>
        </div>
    );
};

const Timeline = () => (
    <div className="flex items-start justify-between">
        <div className="flex flex-col items-center flex-1">
            <div className="relative">
                <div className="w-7 h-7 rounded-full bg-success flex items-center justify-center text-white text-xs font-bold">✓</div>
                <div className="absolute inset-0 rounded-full border-2 border-success opacity-30 animate-pulse-ring" />
            </div>
            <span className="text-[10px] font-bold text-success mt-2">RESERVADA</span>
        </div>
        <div className="flex-1 h-0.5 bg-sky-main mt-3.5" />
        <div className="flex flex-col items-center flex-1">
            <div className="relative">
                <div className="w-7 h-7 rounded-full bg-sky-main" />
                <div className="absolute inset-0 rounded-full border-2 border-sky-main opacity-40 animate-pulse-ring" />
            </div>
            <span className="text-[10px] font-bold text-sky-main mt-2">RECORDATORIO</span>
        </div>
        <div className="flex-1 h-0.5 mt-3.5 border-t-2 border-dashed border-gray-300" />
        <div className="flex flex-col items-center flex-1">
            <div className="w-7 h-7 rounded-full bg-white border-2 border-gray-300" />
            <span className="text-[10px] font-bold text-mute mt-2">VISITA</span>
        </div>
    </div>
);