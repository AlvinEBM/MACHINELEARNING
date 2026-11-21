"""
Simulación de eventos discretos (SimPy) del rendimiento del agente en servidores de distinto tamaño.

La prueba de carga solo puede medir el equipo en que se ejecuta. Para estimar el comportamiento en un servidor
como el del establecimiento, se construye un modelo de colas calibrado con las mediciones:

  * Cada solicitud necesita un tiempo de servicio S, que se muestrea de la distribución empírica medida con un
    usuario (reports/prueba_carga_mysql.json) y se escala para que su media sea igual al tiempo de servicio
    efectivo en saturación (1 / rendimiento máximo por núcleo), que incluye la contención entre procesos.
  * El servidor tiene c núcleos y c procesos (workers): es una cola M/G/c en la que cada solicitud espera hasta
    que un worker quede libre.
  * Las solicitudes llegan según un proceso de Poisson de tasa λ = trabajadores × solicitudes por minuto / 60.

Validación: el mismo modelo se ejecuta con los parámetros de las pruebas reales (modelo cerrado con 1 a 100
usuarios simultáneos, y modelo abierto de Locust) y se compara con lo medido. Proyección: se calcula la
latencia (p50, p95, p99) para 2, 4 y 8 núcleos con distintos niveles de demanda, y la tasa máxima que mantiene
el percentil 95 por debajo de 500 ms.

Uso:  python -m src.simulacion_carga      (genera reports/simulacion_carga.json)
"""
import json
import random
import statistics

import simpy

from .config import REPORTS_DIR

SEMILLA = 42
META_MS = 500


def _percentil(v, p):
    v = sorted(v)
    k = (len(v) - 1) * p / 100
    f = int(k)
    return v[f] if f == k else v[f] + (v[min(f + 1, len(v) - 1)] - v[f]) * (k - f)


def _resumen(lat):
    return {"p50_ms": round(statistics.median(lat), 1), "p95_ms": round(_percentil(lat, 95), 1),
            "p99_ms": round(_percentil(lat, 99), 1)}


class Modelo:
    def __init__(self, muestras_ms, media_ms):
        f = media_ms / statistics.mean(muestras_ms)
        self.muestras = [m * f for m in muestras_ms]

    def servicio(self, rng):
        return rng.choice(self.muestras) / 1000

    # ---------- modelo abierto: llegadas de Poisson
    def abierto(self, c, tasa, n=20000, semilla=SEMILLA):
        rng = random.Random(semilla)
        env = simpy.Environment()
        cpu = simpy.Resource(env, capacity=c)
        lat = []

        def solicitud():
            t0 = env.now
            with cpu.request() as turno:
                yield turno
                yield env.timeout(self.servicio(rng))
            lat.append((env.now - t0) * 1000)

        def llegadas():
            for _ in range(n):
                env.process(solicitud())
                yield env.timeout(rng.expovariate(tasa))

        env.process(llegadas())
        env.run()
        lat = lat[n // 10:]  # descarta el calentamiento
        return {**_resumen(lat), "utilizacion": round(tasa * statistics.mean(self.muestras) / 1000 / c, 3)}

    # ---------- modelo cerrado: N usuarios sin pausa (como src/prueba_carga.py)
    def cerrado(self, c, usuarios, n=4000, semilla=SEMILLA):
        rng = random.Random(semilla)
        env = simpy.Environment()
        cpu = simpy.Resource(env, capacity=c)
        lat, hechas = [], [0]

        def usuario():
            while hechas[0] < n:
                hechas[0] += 1
                t0 = env.now
                with cpu.request() as turno:
                    yield turno
                    yield env.timeout(self.servicio(rng))
                lat.append((env.now - t0) * 1000)

        for _ in range(usuarios):
            env.process(usuario())
        env.run()
        return {**_resumen(lat), "solicitudes_por_segundo": round(len(lat) / env.now, 1)}

    def tasa_maxima(self, c, meta_ms=META_MS):
        """Mayor tasa de llegada (solicitudes/s) con p95 < meta, por búsqueda binaria."""
        lo, hi = 0.1, c / (statistics.mean(self.muestras) / 1000)
        for _ in range(18):
            mid = (lo + hi) / 2
            if self.abierto(c, mid, n=8000)["p95_ms"] < meta_ms:
                lo = mid
            else:
                hi = mid
        return round(lo, 1)


def main():
    medido = json.loads((REPORTS_DIR / "prueba_carga_mysql.json").read_text(encoding="utf-8"))
    una = medido["MySQL 1 workers"][0]
    muestras = una["latencias_ms"]
    # tiempo de servicio efectivo por núcleo en saturación (1 worker, 50-100 usuarios)
    sat1 = [r["solicitudes_por_segundo"] for r in medido["MySQL 1 workers"] if r["usuarios_simultaneos"] >= 50]
    sat2 = [r["solicitudes_por_segundo"] for r in medido["MySQL 2 workers"] if r["usuarios_simultaneos"] >= 50]
    s_eff = 1000 / statistics.mean(sat1)          # ms por solicitud y núcleo, con 1 núcleo efectivo
    s_eff2 = 2 * 1000 / statistics.mean(sat2)     # ídem con 2 núcleos (incluye la CPU que usa el cliente)
    media = max(s_eff, s_eff2)                    # calibración conservadora
    m = Modelo(muestras, media)
    res = {"calibracion": {"servicio_un_usuario_ms": round(statistics.mean(muestras), 2),
                           "servicio_efectivo_1_worker_ms": round(s_eff, 2),
                           "servicio_efectivo_2_workers_ms": round(s_eff2, 2),
                           "servicio_usado_ms": round(media, 2)}}

    # validación con el modelo cerrado
    val = []
    for w in (1, 2):
        for r in medido[f"MySQL {w} workers"]:
            u = r["usuarios_simultaneos"]
            s = m.cerrado(w, u)
            val.append({"workers": w, "usuarios": u, "medido_p95_ms": r["p95_ms"], "simulado_p95_ms": s["p95_ms"],
                        "medido_rps": r["solicitudes_por_segundo"], "simulado_rps": s["solicitudes_por_segundo"]})
    res["validacion_cerrado"] = val

    # validación con el modelo abierto: resultados de Locust (reports/locust/w{workers}_u{trabajadores}_stats.csv)
    import pandas as pd
    vl = []
    for w in (1, 2):
        for u in (50, 100, 200, 400):
            f = REPORTS_DIR / "locust" / f"w{w}_u{u}_stats.csv"
            if not f.exists():
                continue
            r = pd.read_csv(f).query("Name == 'Aggregated'").iloc[0]
            s = m.abierto(w, float(r["Requests/s"]))
            vl.append({"workers": w, "trabajadores": u, "rps": round(float(r["Requests/s"]), 1),
                       "errores": int(r["Failure Count"]), "medido_p50_ms": float(r["50%"]),
                       "medido_p95_ms": float(r["95%"]), "simulado_p50_ms": s["p50_ms"], "simulado_p95_ms": s["p95_ms"],
                       "utilizacion_simulada": s["utilizacion"]})
    res["validacion_abierto"] = vl

    # proyección
    escenarios = []
    for trabajadores, por_min in [(40, 1), (40, 3), (100, 2), (200, 2), (500, 2)]:
        tasa = trabajadores * por_min / 60
        for c in (2, 4, 8):
            s = m.abierto(c, tasa)
            escenarios.append({"trabajadores": trabajadores, "solicitudes_por_minuto": por_min,
                               "tasa_por_segundo": round(tasa, 2), "nucleos": c, **s})
    res["proyeccion"] = escenarios
    res["tasa_maxima_p95_500ms"] = {c: m.tasa_maxima(c) for c in (1, 2, 4, 8)}
    # margen de seguridad: el modelo subestimó hasta en 30 % el p95 medido por debajo de la saturación,
    # por lo que también se calcula la tasa que mantiene el p95 simulado bajo 500 / 1,3 ≈ 385 ms
    res["tasa_maxima_con_margen_30"] = {c: m.tasa_maxima(c, META_MS / 1.3) for c in (1, 2, 4, 8)}
    errores = [abs(v["simulado_p95_ms"] - v["medido_p95_ms"]) / v["medido_p95_ms"] for v in val]
    errores += [abs(v["simulado_p95_ms"] - v["medido_p95_ms"]) / v["medido_p95_ms"] for v in vl
                if v["utilizacion_simulada"] < 0.7]
    res["error_relativo_p95"] = {"medio": round(statistics.mean(errores), 3), "maximo": round(max(errores), 3),
                                 "n_comparaciones": len(errores)}
    (REPORTS_DIR / "simulacion_carga.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in res.items()}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
