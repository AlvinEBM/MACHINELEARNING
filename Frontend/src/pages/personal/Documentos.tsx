// =================================================================
// Documentos médicos — vista del personal de salud.
//
// Dos formas de solicitar un documento, ambas evaluadas por el agente:
//   1. Chat en lenguaje natural ("Necesito la HC de Juan Perez").
//   2. Botón "Solicitar acceso" en el listado de documentos.
// El contenido clínico solo se muestra si el agente AUTORIZA.
// =================================================================
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { HeaderPersonal } from '../../components/layout/HeaderPersonal';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Boton } from '../../components/common/Boton';
import { DecisionCard, NOMBRE_TIPO } from '../../components/documentos/DecisionCard';
import { documentosApi } from '../../api/documentosApi';
import { useAuth } from '../../auth/useAuth';
import { DocumentoListado, RespuestaChat, ResultadoAcceso, SolicitudExcepcional } from '../../types';

interface MensajeChat {
    id: number;
    autor: 'usuario' | 'agente';
    texto?: string;
    resultado?: ResultadoAcceso;
    opciones?: DocumentoListado[];
}

const SUGERENCIAS = [
    'Necesito la historia clínica de Juan Perez',
    'Muéstrame los resultados de laboratorio de 71234567',
    'Quiero ver la orden médica de Maria Quispe',
];

const extraerError = (e: any): string =>
    e?.response?.data?.detalle?.[0]?.errores?.[0] ?? e?.response?.data?.mensaje ?? 'No se pudo procesar la solicitud';

export const Documentos = () => {
    const { user } = useAuth();
    const [documentos, setDocumentos] = useState<DocumentoListado[]>([]);
    const [filtro, setFiltro] = useState('');
    const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
    const [texto, setTexto] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [misSolicitudes, setMisSolicitudes] = useState<SolicitudExcepcional[]>([]);
    const finChat = useRef<HTMLDivElement>(null);

    const cargarSolicitudes = async () => {
        try {
            setMisSolicitudes(await documentosApi.misSolicitudes());
        } catch {
            /* no bloqueante */
        }
    };

    useEffect(() => {
        documentosApi.listar().then(setDocumentos).catch(() => setDocumentos([]));
        cargarSolicitudes();
    }, []);

    useEffect(() => {
        finChat.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [mensajes]);

    const agregar = (m: Omit<MensajeChat, 'id'>) =>
        setMensajes(prev => [...prev, { ...m, id: Date.now() + Math.random() }]);

    // ---------- Chat en lenguaje natural ----------
    const enviarChat = async (mensaje: string) => {
        if (!mensaje.trim() || procesando) return;
        agregar({ autor: 'usuario', texto: mensaje });
        setTexto('');
        setProcesando(true);
        try {
            const r: RespuestaChat = await documentosApi.chat(mensaje);
            if (r.tipo === 'decision' && r.decision) {
                agregar({ autor: 'agente', resultado: r as ResultadoAcceso });
            } else {
                agregar({ autor: 'agente', texto: r.respuesta, opciones: r.opciones });
            }
        } catch (e) {
            agregar({ autor: 'agente', texto: extraerError(e) });
        } finally {
            setProcesando(false);
        }
    };

    // ---------- Acceso desde el listado o desde una opción del chat ----------
    const solicitarAcceso = async (doc: DocumentoListado) => {
        if (procesando) return;
        agregar({ autor: 'usuario', texto: `Solicito acceso: ${doc.titulo}` });
        setProcesando(true);
        try {
            const r = await documentosApi.acceder(doc.id_documento);
            agregar({ autor: 'agente', resultado: r });
        } catch (e) {
            agregar({ autor: 'agente', texto: extraerError(e) });
        } finally {
            setProcesando(false);
        }
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        enviarChat(texto);
    };

    const filtrados = useMemo(() => {
        const f = filtro.trim().toLowerCase();
        if (!f) return documentos;
        return documentos.filter(d =>
            [d.titulo, d.paciente, d.dependiente ?? '', d.dni_paciente ?? '', d.medico_tratante]
                .some(v => v.toLowerCase().includes(f)));
    }, [documentos, filtro]);

    return (
        <div className="min-h-screen bg-smoke">
            <HeaderPersonal />

            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-extrabold text-ink">Documentos médicos</h1>
                    <p className="text-sm text-mute mt-1">
                        Hola, {user?.nombres}. Cada solicitud es evaluada por el agente de IA según tu rol, tu relación con el
                        paciente y tu patrón de acceso, y queda registrada en la auditoría.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
                    {/* ================= CHAT CON EL AGENTE ================= */}
                    <Card className="flex flex-col h-[calc(100vh-190px)] min-h-[520px]">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-sky-soft flex items-center justify-center text-lg">🤖</div>
                            <div>
                                <p className="text-sm font-extrabold text-ink">Asistente de acceso</p>
                                <p className="text-xs text-mute">Árbol de Decisión · Isolation Forest · Regresión Logística</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {mensajes.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-sm text-mute mb-4">Escribe tu solicitud como lo harías con un colega:</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {SUGERENCIAS.map(s => (
                                            <button key={s} onClick={() => enviarChat(s)}
                                                    className="px-3 py-2 text-xs font-semibold rounded-full bg-sky-soft text-sky-deep hover:bg-sky-bright hover:text-white transition-colors">
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {mensajes.map(m => (
                                <div key={m.id} className={m.autor === 'usuario' ? 'flex justify-end' : 'flex justify-start'}>
                                    {m.autor === 'usuario' ? (
                                        <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-br-sm bg-sky-main text-white text-sm">{m.texto}</div>
                                    ) : m.resultado ? (
                                        <div className="w-full">
                                            <DecisionCard resultado={m.resultado} onSolicitudEnviada={cargarSolicitudes} />
                                        </div>
                                    ) : (
                                        <div className="max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-sm bg-smoke text-sm text-ink-soft">
                                            <p>{m.texto}</p>
                                            {m.opciones && (
                                                <div className="mt-2 space-y-1">
                                                    {m.opciones.map(o => (
                                                        <button key={o.id_documento} onClick={() => solicitarAcceso(o)}
                                                                className="block w-full text-left px-3 py-2 rounded-lg bg-white hover:bg-sky-soft text-xs">
                                                            <span className="font-semibold text-ink">{o.titulo}</span>
                                                            <span className="text-mute"> · {NOMBRE_TIPO[o.tipo_documento]}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {procesando && (
                                <div className="flex items-center gap-2 text-xs text-mute">
                                    <span className="w-2 h-2 rounded-full bg-sky-main animate-pulse" /> El agente está evaluando la solicitud…
                                </div>
                            )}
                            <div ref={finChat} />
                        </div>

                        <form onSubmit={onSubmit} className="p-4 border-t border-gray-100 flex gap-2">
                            <input
                                value={texto}
                                onChange={e => setTexto(e.target.value)}
                                placeholder="Ej.: Necesito la historia clínica de Juan Perez"
                                className="flex-1 px-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-bright"
                            />
                            <Boton type="submit" disabled={procesando || !texto.trim()}>Enviar</Boton>
                        </form>
                    </Card>

                    {/* ================= LISTADO + MIS SOLICITUDES ================= */}
                    <div className="space-y-6">
                        <Card>
                            <div className="px-5 py-4 border-b border-gray-100">
                                <p className="text-sm font-extrabold text-ink mb-3">Documentos registrados ({documentos.length})</p>
                                <input
                                    value={filtro}
                                    onChange={e => setFiltro(e.target.value)}
                                    placeholder="Buscar por paciente, DNI, título o médico"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-bright"
                                />
                            </div>
                            <ul className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                                {filtrados.map(d => (
                                    <li key={d.id_documento} className="px-5 py-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-ink truncate">{d.titulo}</p>
                                            <p className="text-xs text-mute truncate">
                                                {d.dependiente ? `${d.dependiente} (dependiente de ${d.paciente})` : d.paciente}
                                                {' · '}Tratante: {d.medico_tratante}
                                            </p>
                                            <div className="mt-1"><Badge variante="sky">{NOMBRE_TIPO[d.tipo_documento].toUpperCase()}</Badge></div>
                                        </div>
                                        <Boton tamano="sm" variante="secondary" onClick={() => solicitarAcceso(d)} disabled={procesando}>
                                            Solicitar acceso
                                        </Boton>
                                    </li>
                                ))}
                                {filtrados.length === 0 && <li className="px-5 py-6 text-sm text-mute text-center">Sin resultados</li>}
                            </ul>
                        </Card>

                        <Card>
                            <div className="px-5 py-4 border-b border-gray-100">
                                <p className="text-sm font-extrabold text-ink">Mis solicitudes de autorización</p>
                            </div>
                            <ul className="divide-y divide-gray-100">
                                {misSolicitudes.length === 0 && (
                                    <li className="px-5 py-4 text-sm text-mute">Aún no has enviado solicitudes.</li>
                                )}
                                {misSolicitudes.map(s => (
                                    <li key={s.id_solicitud} className="px-5 py-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-ink truncate">{s.documento}</p>
                                            <p className="text-xs text-mute truncate">{s.motivo}</p>
                                        </div>
                                        <Badge variante={s.estado === 'APROBADA' ? 'success' : s.estado === 'RECHAZADA' ? 'danger' : 'warning'}>
                                            {s.estado}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};
