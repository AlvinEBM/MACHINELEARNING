"""
Prueba de carga del endpoint POST /api/evaluaracceso con usuarios simultáneos (modelo cerrado, sin pausas).

Requiere la API en ejecución, por ejemplo con la auditoría en MySQL y varios procesos:
    set AGENTE_DB_URL=mysql+pymysql://root:1234@localhost:3306/MachineCitasMedicasSanGenaro
    gunicorn src.api:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8000     (Linux, recomendado)
    uvicorn src.api:app --port 8000                                                (1 proceso, Windows)
y luego:
    python -m src.prueba_carga --niveles 1 5 10 20 50 100 --solicitudes 400 --etiqueta "MySQL 2 workers" --salida prueba_carga_mysql.json

Cada solicitud toma un escenario al azar de data/escenarios_evaluacion.csv, con un usuario al azar entre 50,
y NO envía la frecuencia: el agente la calcula leyendo la auditoría, como ocurre en el sistema real
(cada solicitud implica una lectura y una escritura en la base de auditoría).
Mide la latencia percibida por el cliente (p50, p95, p99 y máximo), el rendimiento (solicitudes por segundo),
la proporción de errores y, con --medir-cpu, el tiempo de CPU que consumen por solicitud los procesos del
servidor (API) y de la base de datos (mysqld). Ese tiempo es la demanda de servicio que usa el modelo de
simulación (src/simulacion_carga.py).
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


def _cpu(patrones):
    """Segundos de CPU acumulados por los procesos cuyo comando contiene alguno de los patrones."""
    import psutil
    total = {p: 0.0 for p in patrones}
    for pr in psutil.process_iter(["cmdline", "name"]):
        try:
            cmd = " ".join(pr.info["cmdline"] or []) or (pr.info["name"] or "")
            for p in patrones:
                if p in cmd:
                    t = pr.cpu_times()
                    total[p] += t.user + t.system
                    break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return total


async def nivel(url, concurrencia, cuerpos, medir_cpu=False):
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

    limites = httpx.Limits(max_connections=concurrencia + 5, max_keepalive_connections=concurrencia + 5)
    async with httpx.AsyncClient(timeout=60, limits=limites) as cliente:
        await cliente.post(f"{url}/api/evaluaracceso", json=cuerpos[0])  # calentamiento
        cpu0 = _cpu(["src.api:app", "mysqld"]) if medir_cpu else None
        inicio = time.perf_counter()
        await asyncio.gather(*(usuario(cliente) for _ in range(concurrencia)))
        dur = time.perf_counter() - inicio
        cpu1 = _cpu(["src.api:app", "mysqld"]) if medir_cpu else None
    res = {"usuarios_simultaneos": concurrencia, "solicitudes": len(cuerpos), "errores": errores,
           "p50_ms": round(statistics.median(lat), 1), "p95_ms": round(_percentil(lat, 95), 1),
           "p99_ms": round(_percentil(lat, 99), 1), "max_ms": round(max(lat), 1),
           "solicitudes_por_segundo": round(len(cuerpos) / dur, 1)}
    if medir_cpu:
        n = len(cuerpos)
        res["cpu_ms_por_solicitud_api"] = round((cpu1["src.api:app"] - cpu0["src.api:app"]) * 1000 / n, 2)
        res["cpu_ms_por_solicitud_bd"] = round((cpu1["mysqld"] - cpu0["mysqld"]) * 1000 / n, 2)
    if concurrencia == 1:
        res["latencias_ms"] = [round(x, 2) for x in lat]  # distribución usada por la simulación
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--niveles", type=int, nargs="+", default=[1, 5, 10, 20, 50])
    ap.add_argument("--solicitudes", type=int, default=300)
    ap.add_argument("--etiqueta", default="1 worker")
    ap.add_argument("--salida", default="prueba_carga.json")
    ap.add_argument("--medir-cpu", action="store_true", help="medir la CPU de uvicorn y mysqld (mismo equipo)")
    a = ap.parse_args()
    res = [asyncio.run(nivel(a.url, n, _cuerpos(a.solicitudes, semilla=n), a.medir_cpu)) for n in a.niveles]
    for r in res:
        print({k: v for k, v in r.items() if k != "latencias_ms"})
    destino = REPORTS_DIR / a.salida
    previo = json.loads(destino.read_text(encoding="utf-8")) if destino.exists() else {}
    previo[a.etiqueta] = res
    destino.write_text(json.dumps(previo, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
