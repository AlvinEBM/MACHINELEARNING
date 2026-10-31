// =================================================================
// Perfil del Paciente.
// Muestra datos personales + contadores estadísticos.
// =================================================================
import { useEffect, useState } from 'react';

import { Header } from '../../components/layout/Header';
import { Card } from '../../components/common/Card';

import { useAuth } from '../../auth/useAuth';
import { citasApi } from '../../api/citasApi';
import { ContadoresPaciente } from '../../types';
import { obtenerIniciales } from '../../utils/formatters';

export const Perfil = () => {
    const { user } = useAuth();
    const [contadores, setContadores] = useState<ContadoresPaciente | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await citasApi.contadores();
                setContadores(data);
            } catch (e) {
                console.error('Error cargando contadores:', e);
            }
        })();
    }, []);

    return (
        <div className="min-h-screen bg-smoke">
            <Header />

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Header del perfil */}
                <Card className="p-8 mb-6">
                    <div className="flex items-center gap-6">
                        {/* Avatar grande */}
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-main to-sky-deep flex items-center justify-center text-white text-3xl font-bold shadow-cta">
                            {user ? obtenerIniciales(user.nombres, user.apellidos) : '?'}
                        </div>

                        <div className="flex-1">
                            <h1 className="text-3xl font-extrabold text-blue-deep">
                                {user?.nombres} {user?.apellidos}
                            </h1>
                            <p className="text-sm text-mute mt-1">{user?.correo}</p>
                            <span className="inline-block mt-2 px-3 py-1 bg-sky-soft text-sky-deep text-xs font-bold rounded-full">
                                Paciente
                            </span>
                        </div>
                    </div>
                </Card>

                {/* ====== Estadísticas ====== */}
                <h2 className="text-xs font-bold text-sky-deep tracking-widest mb-3">
                    📊 ESTADÍSTICAS DE TUS CITAS
                </h2>

                {!contadores && (
                    <Card className="p-8 text-center">
                        <p className="text-mute text-sm">Cargando estadísticas...</p>
                    </Card>
                )}

                {contadores && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <Card className="p-6">
                            <p className="text-[11px] font-bold text-mute tracking-widest uppercase mb-2">
                                Total citas
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-4xl font-extrabold text-blue-deep">
                                    {contadores.total}
                                </span>
                                <div className="w-10 h-10 rounded-full bg-sky-soft flex items-center justify-center text-lg">
                                    📅
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <p className="text-[11px] font-bold text-mute tracking-widest uppercase mb-2">
                                Completadas
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-4xl font-extrabold text-success">
                                    {contadores.completadas}
                                </span>
                                <div className="w-10 h-10 rounded-full bg-success-soft flex items-center justify-center text-success text-lg font-bold">
                                    ✓
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <p className="text-[11px] font-bold text-mute tracking-widest uppercase mb-2">
                                Próximas
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-4xl font-extrabold text-sky-main">
                                    {contadores.proximas}
                                </span>
                                <div className="w-10 h-10 rounded-full bg-sky-soft flex items-center justify-center text-lg">
                                    ⏰
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <p className="text-[11px] font-bold text-mute tracking-widest uppercase mb-2">
                                Faltas
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-4xl font-extrabold text-danger">
                                    {contadores.faltas}
                                </span>
                                <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center text-danger text-lg font-bold">
                                    ⚠
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* ====== Datos personales ====== */}
                <h2 className="text-xs font-bold text-sky-deep tracking-widest mb-3 mt-8">
                    👤 DATOS PERSONALES
                </h2>

                <Card className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DatoCampo label="Nombres" valor={user?.nombres ?? '-'} />
                        <DatoCampo label="Apellidos" valor={user?.apellidos ?? '-'} />
                        <DatoCampo label="Correo electrónico" valor={user?.correo ?? '-'} />
                        <DatoCampo label="Rol" valor={user?.rol ?? '-'} />
                    </div>

                    <p className="text-xs text-mute mt-6 italic">
                        Para editar tus datos personales, contacta al personal de admisión.
                    </p>
                </Card>
            </main>
        </div>
    );
};

const DatoCampo = ({ label, valor }: { label: string; valor: string }) => (
    <div>
        <p className="text-[11px] font-bold text-mute uppercase tracking-widest mb-1">
            {label}
        </p>
        <p className="text-sm text-ink-soft font-semibold">{valor}</p>
    </div>
);