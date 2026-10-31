// =================================================================
// Tarjeta con la decisión del agente de IA sobre una solicitud de
// acceso. Muestra la explicación en lenguaje natural, las tres fases
// del pipeline (Árbol de Decisión, Isolation Forest, Regresión
// Logística), el contenido del documento si fue autorizado y el
// formulario de autorización excepcional cuando corresponde.
// =================================================================
import { useState } from 'react';

import { Badge } from '../common/Badge';
import { Boton } from '../common/Boton';
import { documentosApi } from '../../api/documentosApi';
import { DecisionAcceso, NivelAlerta, ResultadoAcceso } from '../../types';

export const NOMBRE_TIPO: Record<string, string> = {
    historia_clinica: 'Historia clínica',
    resultado_laboratorio: 'Resultado de laboratorio',
    orden_medica: 'Orden médica',
};

const NOMBRE_RELACION: Record<string, string> = {
    medico_tratante: 'Médico tratante',
    personal_apoyo: 'Personal de apoyo',
    sin_relacion: 'Sin relación con el paciente',
};

export const BadgeDecision = ({ decision }: { decision: DecisionAcceso | null }) => {
    if (decision === 'AUTORIZAR') return <Badge variante="success" conPunto>AUTORIZADO</Badge>;
    if (decision === 'REQUIERE_APROBACION') return <Badge variante="warning" conPunto>REQUIERE APROBACIÓN</Badge>;
    if (decision === 'RECHAZAR') return <Badge variante="danger" conPunto>RECHAZADO</Badge>;
    return <Badge variante="gray">—</Badge>;
};

export const BadgeNivel = ({ nivel }: { nivel: NivelAlerta }) => {
    if (nivel === 'CRITICO') return <Badge variante="danger">⚠ CRÍTICO</Badge>;
    if (nivel === 'ADVERTENCIA') return <Badge variante="warning">⚠ ADVERTENCIA</Badge>;
    if (nivel === 'NORMAL') return <Badge variante="success">✓ NORMAL</Badge>;
    return <Badge variante="gray">NO DISPONIBLE</Badge>;
};

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(0)} %`);

interface Props {
    resultado: ResultadoAcceso;
    compacto?: boolean;
    onSolicitudEnviada?: () => void;
}

export const DecisionCard = ({ resultado, compacto = false, onSolicitudEnviada }: Props) => {
    const [motivo, setMotivo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [mensaje, setMensaje] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { decision, evaluacion, documento, contexto } = resultado;
    const estilo = {
        AUTORIZAR: 'border-l-success',
        REQUIERE_APROBACION: 'border-l-warning',
        RECHAZAR: 'border-l-danger',
    }[decision];

    const enviarSolicitud = async () => {
        setEnviando(true);
        setError(null);
        try {
            const r = await documentosApi.solicitarExcepcional(documento.id_documento, motivo);
            setMensaje(r.mensaje);
            onSolicitudEnviada?.();
        } catch (e: any) {
            setError(e?.response?.data?.detalle?.[0]?.errores?.[0] ?? e?.response?.data?.mensaje ?? 'No se pudo enviar la solicitud');
        } finally {
            setEnviando(false);
        }
    };

    const score = evaluacion.score_anomalia ?? 0;
    const colorBarra = evaluacion.nivel_alerta === 'CRITICO' ? 'bg-danger'
        : evaluacion.nivel_alerta === 'ADVERTENCIA' ? 'bg-warning' : 'bg-success';

    return (
        <div className={`bg-white rounded-2xl shadow-card border-l-[6px] ${estilo} overflow-hidden`}>
            <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                        <p className="text-[11px] font-bold tracking-widest text-mute">{NOMBRE_TIPO[documento.tipo_documento]?.toUpperCase()}</p>
                        <h3 className="text-base font-extrabold text-ink">{documento.titulo}</h3>
                    </div>
                    <BadgeDecision decision={decision} />
                </div>
                <p className="text-sm text-ink-soft leading-relaxed">{resultado.explicacion}</p>
                <p className="text-xs text-mute mt-2">
                    Relación detectada: <span className="font-semibold text-ink-soft">{NOMBRE_RELACION[contexto.relacion_paciente]}</span>
                    {contexto.autorizacion_excepcional && <> · <span className="font-semibold text-success-deep">Autorización excepcional vigente</span></>}
                </p>
            </div>

            {/* ---- Cómo decidió el agente ---- */}
            {!compacto && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-100 border-t border-gray-100">
                    <div className="bg-smoke p-4">
                        <p className="text-[10px] font-bold tracking-widest text-mute mb-1">FASE 1 · ÁRBOL DE DECISIÓN</p>
                        <div className="mb-2"><BadgeDecision decision={evaluacion.decision_arbol} /></div>
                        <ul className="space-y-0.5">
                            {evaluacion.ruta_arbol.map((r, i) => (
                                <li key={i} className="text-xs text-ink-soft">• {r}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-smoke p-4">
                        <p className="text-[10px] font-bold tracking-widest text-mute mb-1">FASE 2 · ISOLATION FOREST</p>
                        <div className="mb-2"><BadgeNivel nivel={evaluacion.nivel_alerta} /></div>
                        <div className="h-2 rounded-full bg-gray-200 overflow-hidden" title="Puntaje de anomalía">
                            <div className={`h-full ${colorBarra}`} style={{ width: `${Math.min(score, 1) * 100}%` }} />
                        </div>
                        <p className="text-xs text-mute mt-1">
                            Puntaje de anomalía: <span className="font-semibold text-ink-soft">{evaluacion.score_anomalia?.toFixed(2) ?? '—'}</span>
                            {' '}(advertencia ≥ 0,70 · crítico &gt; 0,85)
                        </p>
                    </div>
                    <div className="bg-smoke p-4">
                        <p className="text-[10px] font-bold tracking-widest text-mute mb-1">FASE 3 · REGRESIÓN LOGÍSTICA</p>
                        {evaluacion.prob_legitimidad === null ? (
                            <p className="text-xs text-mute">No fue necesaria: el caso no era ambiguo.</p>
                        ) : (
                            <>
                                <p className="text-2xl font-extrabold text-blue-deep">{pct(evaluacion.prob_legitimidad)}</p>
                                <p className="text-xs text-mute">Probabilidad de legitimidad (&gt; 90 % autoriza · 60–90 % aprobación)</p>
                            </>
                        )}
                        <p className="text-[11px] text-mute mt-2">
                            Tiempo de respuesta: {evaluacion.tiempo_respuesta_ms?.toFixed(0) ?? '—'} ms
                            {evaluacion.id_log && <> · registro de auditoría #{evaluacion.id_log}</>}
                        </p>
                    </div>
                </div>
            )}

            {/* ---- Contenido autorizado ---- */}
            {decision === 'AUTORIZAR' && documento.contenido && (
                <div className="p-5 border-t border-gray-100 bg-success-soft/40">
                    <p className="text-[10px] font-bold tracking-widest text-success-deep mb-2">CONTENIDO DEL DOCUMENTO</p>
                    <p className="text-sm text-ink whitespace-pre-line">{documento.contenido}</p>
                </div>
            )}

            {/* ---- Autorización excepcional ---- */}
            {resultado.solicitud_pendiente && !mensaje && (
                <div className="p-4 border-t border-gray-100 text-sm text-warning font-semibold">
                    Ya tienes una solicitud de autorización pendiente para este documento.
                </div>
            )}
            {resultado.puede_solicitar_excepcional && !mensaje && (
                <div className="p-5 border-t border-gray-100">
                    <p className="text-sm font-bold text-ink mb-1">Solicitar autorización excepcional</p>
                    <p className="text-xs text-mute mb-3">
                        Explica por qué necesitas este documento (por ejemplo, el médico tratante no está disponible).
                        La administración revisará tu solicitud; si la aprueba, tendrás acceso por 24 horas.
                    </p>
                    <textarea
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-bright"
                        placeholder="Motivo de la solicitud"
                    />
                    {error && <p className="text-xs text-danger mt-1">{error}</p>}
                    <div className="mt-2 flex justify-end">
                        <Boton tamano="sm" onClick={enviarSolicitud} disabled={enviando || motivo.trim().length < 10}>
                            {enviando ? 'Enviando…' : 'Enviar solicitud'}
                        </Boton>
                    </div>
                </div>
            )}
            {mensaje && <div className="p-4 border-t border-gray-100 text-sm text-success-deep font-semibold">✓ {mensaje}</div>}
        </div>
    );
};
