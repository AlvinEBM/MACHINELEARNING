// =================================================================
// Panel de auditoría del agente de IA (solo ADMIN).
//   - Indicadores del agente (solicitudes, decisiones, alertas, tiempo).
//   - Solicitudes de autorización excepcional pendientes (aprobar/rechazar).
//   - Alertas de accesos anómalos detectadas por Isolation Forest.
//   - Últimos registros de auditoría (inmutables).
// =================================================================
import { useEffect, useState } from 'react';

import { HeaderPersonal } from '../../components/layout/HeaderPersonal';
import { Card } from '../../components/common/Card';
import { Boton } from '../../components/common/Boton';
import { BadgeDecision, BadgeNivel, NOMBRE_TIPO } from '../../components/documentos/DecisionCard';
import { documentosApi, PanelAuditoria } from '../../api/documentosApi';

const Indicador = ({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) => (
    <Card className="p-5">
        <p className="text-[11px] font-bold tracking-widest text-mute">{titulo}</p>
        <p className="text-3xl font-extrabold text-ink mt-1">{valor}</p>
        {detalle && <p className="text-xs text-mute mt-1">{detalle}</p>}
    </Card>
);

const formatearFechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const Auditoria = () => {
    const [panel, setPanel] = useState<PanelAuditoria | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cargando, setCargando] = useState(true);

    const cargar = async () => {
        try {
            setPanel(await documentosApi.panelAuditoria(50));
            setError(null);
        } catch (e: any) {
            setError(e?.response?.data?.mensaje ?? 'No se pudo cargar el panel de auditoría');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargar();
        const id = setInterval(cargar, 15000); // refresco cada 15 s
        return () => clearInterval(id);
    }, []);

    const responder = async (idSolicitud: number, aprobar: boolean) => {
        await documentosApi.responderSolicitud(idSolicitud, aprobar);
        cargar();
    };

    const revisar = async (idAlerta: number) => {
        await documentosApi.revisarAlerta(idAlerta);
        cargar();
    };

    const e = panel?.estadisticas;
    const total = e?.total_solicitudes ?? 0;
    const porc = (n?: number) => (total ? `${Math.round(((n ?? 0) / total) * 100)} % del total` : '');

    return (
        <div className="min-h-screen bg-smoke">
            <HeaderPersonal />
            <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-ink">Auditoría del agente de IA</h1>
                    <p className="text-sm text-mute mt-1">Cada solicitud de acceso a documentos médicos queda registrada y no puede modificarse.</p>
                </div>

                {cargando && <p className="text-sm text-mute">Cargando…</p>}
                {error && <Card bordeLateral="danger" className="p-4 text-sm text-danger">{error}</Card>}

                {e && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <Indicador titulo="SOLICITUDES" valor={total} detalle={`${e.ultimas_24h} en las últimas 24 h`} />
                        <Indicador titulo="AUTORIZADAS" valor={e.por_decision.AUTORIZAR ?? 0} detalle={porc(e.por_decision.AUTORIZAR)} />
                        <Indicador titulo="RECHAZADAS" valor={e.por_decision.RECHAZAR ?? 0} detalle={porc(e.por_decision.RECHAZAR)} />
                        <Indicador titulo="REQUIEREN APROBACIÓN" valor={e.por_decision.REQUIERE_APROBACION ?? 0} detalle={porc(e.por_decision.REQUIERE_APROBACION)} />
                        <Indicador titulo="ALERTAS PENDIENTES" valor={e.alertas_pendientes}
                                   detalle={`${e.por_nivel_alerta.CRITICO ?? 0} críticas · ${e.por_nivel_alerta.ADVERTENCIA ?? 0} advertencias`} />
                        <Indicador titulo="TIEMPO PROMEDIO" valor={`${Math.round(e.tiempo_respuesta_promedio_ms)} ms`}
                                   detalle={`máximo ${Math.round(e.tiempo_respuesta_maximo_ms)} ms (meta < 500 ms)`} />
                    </div>
                )}

                {panel && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ---------- Solicitudes pendientes ---------- */}
                        <Card>
                            <div className="px-5 py-4 border-b border-gray-100">
                                <p className="text-sm font-extrabold text-ink">Autorizaciones excepcionales pendientes ({panel.solicitudes_pendientes.length})</p>
                            </div>
                            <ul className="divide-y divide-gray-100">
                                {panel.solicitudes_pendientes.length === 0 && <li className="px-5 py-4 text-sm text-mute">No hay solicitudes pendientes.</li>}
                                {panel.solicitudes_pendientes.map(s => (
                                    <li key={s.id_solicitud} className="px-5 py-4">
                                        <p className="text-sm font-semibold text-ink">{s.solicitante} <span className="text-mute font-normal">({s.rol_solicitante})</span></p>
                                        <p className="text-xs text-mute">{s.documento} · paciente {s.paciente} · {formatearFechaHora(s.fecha_solicitud)}</p>
                                        <p className="text-sm text-ink-soft mt-1">«{s.motivo}»</p>
                                        <div className="flex gap-2 mt-2">
                                            <Boton tamano="sm" variante="success" onClick={() => responder(s.id_solicitud, true)}>Aprobar 24 h</Boton>
                                            <Boton tamano="sm" variante="danger" onClick={() => responder(s.id_solicitud, false)}>Rechazar</Boton>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        {/* ---------- Alertas ---------- */}
                        <Card>
                            <div className="px-5 py-4 border-b border-gray-100">
                                <p className="text-sm font-extrabold text-ink">Alertas de accesos anómalos (Isolation Forest)</p>
                            </div>
                            <ul className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
                                {panel.alertas.length === 0 && <li className="px-5 py-4 text-sm text-mute">Sin alertas.</li>}
                                {panel.alertas.map(a => (
                                    <li key={a.id_alerta} className={`px-5 py-3 flex items-center justify-between gap-3 ${a.revisada ? 'opacity-50' : ''}`}>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2"><BadgeNivel nivel={a.nivel} />
                                                <span className="text-xs text-mute">puntaje {a.score_anomalia.toFixed(2)} · usuario #{a.id_usuario}</span>
                                            </div>
                                            <p className="text-xs text-ink-soft mt-1 truncate">{a.descripcion}</p>
                                            <p className="text-[11px] text-mute">{formatearFechaHora(a.fecha)}</p>
                                        </div>
                                        {!a.revisada && <Boton tamano="sm" variante="ghost" onClick={() => revisar(a.id_alerta)}>Revisada</Boton>}
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </div>
                )}

                {/* ---------- Registros de auditoría ---------- */}
                {panel && (
                    <Card>
                        <div className="px-5 py-4 border-b border-gray-100">
                            <p className="text-sm font-extrabold text-ink">Últimos registros de auditoría</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-smoke text-[11px] tracking-widest text-mute">
                                    <tr>
                                        <th className="px-4 py-2 text-left">#</th>
                                        <th className="px-4 py-2 text-left">FECHA</th>
                                        <th className="px-4 py-2 text-left">USUARIO</th>
                                        <th className="px-4 py-2 text-left">DOCUMENTO</th>
                                        <th className="px-4 py-2 text-left">RELACIÓN</th>
                                        <th className="px-4 py-2 text-right">FREC./H</th>
                                        <th className="px-4 py-2 text-left">DECISIÓN</th>
                                        <th className="px-4 py-2 text-left">ANOMALÍA</th>
                                        <th className="px-4 py-2 text-right">MS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {panel.registros.map(r => (
                                        <tr key={r.id_log} title={r.explicacion}>
                                            <td className="px-4 py-2 text-mute">{r.id_log}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{formatearFechaHora(r.fecha)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">#{r.id_usuario} · {r.rol}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{NOMBRE_TIPO[r.tipo_documento] ?? r.tipo_documento}{r.id_documento ? ` #${r.id_documento}` : ''}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-mute">{r.relacion_paciente.replace('_', ' ')}</td>
                                            <td className="px-4 py-2 text-right">{r.frecuencia_accesos}</td>
                                            <td className="px-4 py-2"><BadgeDecision decision={r.decision} /></td>
                                            <td className="px-4 py-2 whitespace-nowrap"><BadgeNivel nivel={r.nivel_alerta} /> <span className="text-xs text-mute">{r.score_anomalia.toFixed(2)}</span></td>
                                            <td className="px-4 py-2 text-right text-mute">{Math.round(r.tiempo_respuesta_ms)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </main>
        </div>
    );
};
