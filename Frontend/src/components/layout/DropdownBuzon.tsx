// =================================================================
// Dropdown de notificaciones (estilo YouTube).
// Se renderiza desde el Header. Se cierra al hacer click fuera.
// =================================================================
import { useEffect, useRef, useState } from 'react';
import { notificacionesApi } from '../../api/notificacionesApi';
import { Notificacion } from '../../types';
import { tiempoRelativo } from '../../utils/formatters';

interface DropdownBuzonProps {
    abierto: boolean;
    onCerrar: () => void;
    onCambioNoLeidas?: (cantidad: number) => void;
}

export const DropdownBuzon = ({ abierto, onCerrar, onCambioNoLeidas }: DropdownBuzonProps) => {
    const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
    const [cargando, setCargando] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Cierre al hacer click fuera
    useEffect(() => {
        if (!abierto) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onCerrar();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [abierto, onCerrar]);

    // Cargar notificaciones cuando se abre
    useEffect(() => {
        if (!abierto) return;
        (async () => {
            setCargando(true);
            try {
                const data = await notificacionesApi.obtenerBuzon();
                setNotificaciones(data.notificaciones ?? []);
                onCambioNoLeidas?.(data.no_leidas ?? 0);
            } catch (e) {
                console.error('Error cargando buzón:', e);
            } finally {
                setCargando(false);
            }
        })();
    }, [abierto, onCambioNoLeidas]);

    const marcarLeida = async (id: number) => {
        try {
            await notificacionesApi.marcarLeida(id);
            setNotificaciones(prev =>
                prev.map(n => n.id_notificacion === id ? { ...n, leida: true } : n)
            );
            // Recalcular no leídas
            const nuevas = notificaciones.filter(n => !n.leida && n.id_notificacion !== id).length;
            onCambioNoLeidas?.(nuevas);
        } catch (e) {
            console.error('Error marcando leída:', e);
        }
    };

    const marcarTodas = async () => {
        const noLeidas = notificaciones.filter(n => !n.leida);
        await Promise.all(noLeidas.map(n => notificacionesApi.marcarLeida(n.id_notificacion).catch(() => null)));
        setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
        onCambioNoLeidas?.(0);
    };

    if (!abierto) return null;

    return (
        <div
            ref={ref}
            className="absolute right-0 top-14 w-80 bg-white rounded-2xl shadow-dropdown overflow-hidden z-50 border border-gray-100"
        >
            {/* Triángulo apuntando al icono */}
            <div className="absolute -top-2 right-8 w-4 h-4 bg-white rotate-45 border-t border-l border-gray-100" />

            {/* Header */}
            <div className="relative px-5 py-4 bg-white flex items-center justify-between border-b border-gray-50">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-ink">Notificaciones</h3>
                    {notificaciones.filter(n => !n.leida).length > 0 && (
                        <span className="px-2 py-0.5 bg-danger text-white text-[10px] font-bold rounded-full">
                            {notificaciones.filter(n => !n.leida).length}
                        </span>
                    )}
                </div>
            </div>

            {/* Lista */}
            <div className="max-h-96 overflow-y-auto">
                {cargando ? (
                    <p className="p-8 text-center text-sm text-mute">Cargando...</p>
                ) : notificaciones.length === 0 ? (
                    <p className="p-8 text-center text-sm text-mute">No tienes notificaciones</p>
                ) : (
                    notificaciones.map(n => (
                        <ItemNotificacion
                            key={n.id_notificacion}
                            notificacion={n}
                            onClick={() => !n.leida && marcarLeida(n.id_notificacion)}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            {notificaciones.some(n => !n.leida) && (
                <div className="px-5 py-3 bg-smoke border-t border-gray-100">
                    <button
                        onClick={marcarTodas}
                        className="w-full text-center text-xs font-bold text-sky-main hover:text-sky-deep"
                    >
                        Marcar todas como leídas
                    </button>
                </div>
            )}
        </div>
    );
};

// ============== Item individual ==============
interface ItemProps {
    notificacion: Notificacion;
    onClick: () => void;
}

const ItemNotificacion = ({ notificacion: n, onClick }: ItemProps) => {
    const esRecordatorio = n.tipo === 'RECORDATORIO';
    const titulo = esRecordatorio ? 'Recordatorio' : 'Cancelación';

    // Estilos según leída o no, y tipo
    const fondoNoLeida = esRecordatorio ? 'bg-sky-soft' : 'bg-danger-soft';
    const fondo = n.leida ? 'bg-white hover:bg-smoke' : fondoNoLeida;

    const iconoColor = n.leida
        ? 'bg-gray-300'
        : esRecordatorio
            ? 'bg-sky-main'
            : 'bg-danger';

    const icono = esRecordatorio ? '⏰' : '✕';

    return (
        <div
            onClick={onClick}
            className={`relative px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors ${fondo}`}
        >
            <div className="flex gap-3">
                {/* Punto no leído */}
                {!n.leida && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-sky-main" />
                )}

                {/* Icono circular */}
                <div className={`w-8 h-8 rounded-full ${iconoColor} flex items-center justify-center text-white text-sm flex-shrink-0`}>
                    {icono}
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${n.leida ? 'text-mute' : 'text-ink'}`}>
                        {titulo}
                    </p>
                    <p className="text-xs text-mute mt-0.5 line-clamp-2">
                        {n.mensaje}
                    </p>
                    <p className="text-[10px] text-mute-soft mt-1">
                        {tiempoRelativo(n.fecha_programada)}
                    </p>
                </div>
            </div>
        </div>
    );
};