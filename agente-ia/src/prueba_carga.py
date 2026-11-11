"""
Prueba de carga del endpoint POST /api/evaluaracceso con usuarios simultáneos.

Requiere la API en ejecución, por ejemplo:
    uvicorn src.api:app --port 8000 --workers 1
y luego:
    python -m src.prueba_carga --url http://127.0.0.1:8000 --niveles 1 5 10 20 50 --solicitudes 300

Cada solicitud toma un escenario al azar de data/escenarios_evaluacion.csv, con un usuario al azar entre 50,
y NO envía la frecuencia: el agente la calcula leyendo la auditoría, como ocurre en el sistema real
(cada solicitud implica una lectura y una escritura en la base de auditoría).
Mide la latencia percibida por el cliente (p50, p95, p99 y máximo), el rendimiento (solicitudes por segundo)
y la proporción de errores. Guarda los resultados en reports/prueba_carga.json.
"""
import argparse
import asyncio
import json
import random
import statistics
import time

import httpx
import pandas as pd

from .config import DATA_DIR, REPORTS_DIR

ROL_API = {"medico": "MEDICO", "enfermeria": "ENFERMERIA", "administrativo": "ADMISION", "administrador": "ADMIN"}


def _cuerpos(n, semilla=7):
    esc = pd.read_csv(DATA_DIR / "escenarios_evaluacion.csv")
    rng = random.Random(semilla)
    filas = [esc.iloc[rng.randrange(len(esc))] for _ in range(n)]
    return [{"usuario_id": rng.randint(1000, 1049), "rol": ROL_API[r.rol_usuario], "tipo_documento": r.tipo_documento,
             "relacion_paciente": r.relacion_paciente, "autorizacion_excepcional": bool(r.autorizacion_excepcional),
             "hora_acceso": r.hora_acceso} for r in filas]


def _percentil(v, p):
    v = sorted(v)
    k = (len(v) - 1) * p / 100
    f = int(k)
    return v[f] if f == k else v[f] + (v[min(f + 1, len(v) - 1)] - v[f]) * (k - f)


async def nivel(url, concurrencia, cuerpos):
    lat, errores = [], 0
    cola = asyncio.Queue()
    for c in cuerpos:
        cola.put_nowait(c)

    async def usuario(cliente):
        nonlocal errores
        while not cola.empty():
            c = cola.get_nowait()
            t = time.perf_counter()
            try:
                r = await cliente.post(f"{url}/api/evaluaracceso", json=c)
                if r.status_code != 200:
                    errores += 1
            except httpx.HTTPError:
                errores += 1
            lat.append((time.perf_counter() - t) * 1000)

    async with httpx.AsyncClient(timeout=30) as cliente:
        await cliente.post(f"{url}/api/evaluaracceso", json=cuerpos[0])  # calentamiento
        inicio = time.perf_counter()
        await asyncio.gather(*(usuario(cliente) for _ in range(concurrencia)))
        dur = time.perf_counter() - inicio
    return {"usuarios_simultaneos": concurrencia, "solicitudes": len(cuerpos), "errores": errores,
            "p50_ms": round(statistics.median(lat), 1), "p95_ms": round(_percentil(lat, 95), 1),
            "p99_ms": round(_percentil(lat, 99), 1), "max_ms": round(max(lat), 1),
            "solicitudes_por_segundo": round(len(cuerpos) / dur, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--niveles", type=int, nargs="+", default=[1, 5, 10, 20, 50])
    ap.add_argument("--solicitudes", type=int, default=300)
    ap.add_argument("--etiqueta", default="1 worker")
    a = ap.parse_args()
    res = [asyncio.run(nivel(a.url, n, _cuerpos(a.solicitudes, semilla=n))) for n in a.niveles]
    for r in res:
        print(r)
    destino = REPORTS_DIR / "prueba_carga.json"
    previo = json.loads(destino.read_text(encoding="utf-8")) if destino.exists() else {}
    previo[a.etiqueta] = res
    destino.write_text(json.dumps(previo, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
