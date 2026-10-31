"""
Evaluación del agente completo con los escenarios de la Tabla 3 del informe y verificación de los
criterios de éxito de la Tabla 1.

Cada escenario se envía al agente (Árbol -> Isolation Forest -> Regresión Logística) y su decisión se
compara con la decisión esperada fijada previamente por la matriz de roles y permisos.

Uso:
  python -m src.evaluar          # lee data/escenarios_evaluacion.csv y audita en un SQLite aparte
  python -m src.evaluar --bd     # lee la muestra de la tabla muestra_escenarios de la base configurada en
                                 # AGENTE_DB_URL (MySQL), registra la auditoría en access_logs y guarda las
                                 # decisiones del agente en la tabla resultados_prueba
"""
import argparse
from datetime import datetime
import json
import time

import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix

from .agente import AgenteAcceso
from .auditoria import AccessLog, Auditoria
from .config import FIGURES_DIR, REPORTS_DIR, DATA_DIR, BASE_DIR, DB_URL
from .entrenar import ETIQUETAS, grafico_matriz
from .nlp import interpretar
from .reglas import DECISIONES

# Solicitudes en lenguaje natural para medir el criterio NLP (≥ 90 %): (mensaje, tipo esperado, paciente esperado)
FRASES_NLP = [
    ("quiero ver la historia de Juan", "historia_clinica", "Juan"),
    ("necesito la HC del paciente García", "historia_clinica", "García"),
    ("dame el expediente de María", "historia_clinica", "María"),
    ("Necesito consultar la historia clínica del paciente Juan Perez porque soy su médico tratante", "historia_clinica", "Juan Perez"),
    ("muéstrame los resultados de laboratorio de 76543210", "resultado_laboratorio", "76543210"),
    ("ver la orden médica de la señora Rosa Quispe", "orden_medica", "Rosa Quispe"),
    ("hola, necesito el hemograma de lucia torres por favor", "resultado_laboratorio", "Lucia Torres"),
    ("revisar la receta del niño Mateo", "orden_medica", "Mateo"),
    ("análisis de Carmen Huamán", "resultado_laboratorio", "Carmen Huamán"),
    ("dame el último examen de la gestante Ana Flores Ruiz", "resultado_laboratorio", "Ana Flores Ruiz"),
    ("abrir ficha de juan perez", "historia_clinica", "Juan Perez"),
    ("necesito el historial clínico de Pedro Castillo", "historia_clinica", "Pedro Castillo"),
    ("puedo ver los exámenes de la paciente Sofía Mendoza", "resultado_laboratorio", "Sofía Mendoza"),
    ("quiero revisar las indicaciones de Luis Ramos", "orden_medica", "Luis Ramos"),
    ("muestra la HC de 45678912", "historia_clinica", "45678912"),
    ("historia clínica de Valeria", "historia_clinica", "Valeria"),
    ("necesito ver la prescripción de Jorge Salas para la farmacia", "orden_medica", "Jorge Salas"),
    ("me das la ecografía de la gestante Milagros Paredes", "resultado_laboratorio", "Milagros Paredes"),
    ("consultar expediente del bebé Thiago Rojas", "historia_clinica", "Thiago Rojas"),
    ("resultado de glucosa de 70123456", "resultado_laboratorio", "70123456"),
    ("la orden de Andrea Vega por favor", "orden_medica", "Andrea Vega"),
    ("abre la historia de rosa quispe", "historia_clinica", "Rosa Quispe"),
    ("ver resultados del paciente Ramírez", "resultado_laboratorio", "Ramírez"),
    ("necesito el tratamiento indicado a Camila Torres", "orden_medica", "Camila Torres"),
    ("quiero los antecedentes de Diego Chávez", "historia_clinica", "Diego Chávez"),
    ("dame los análisis de sangre de Lucía", "resultado_laboratorio", "Lucía"),
    ("historia de 12345678 urgente", "historia_clinica", "12345678"),
    ("buenos días, quiero ver la HC de Martín Soto", "historia_clinica", "Martín Soto"),
    ("revisar el examen de orina de Fiorella Díaz", "resultado_laboratorio", "Fiorella Díaz"),
    ("muéstrame la medicación de la señora Elena Cruz", "orden_medica", "Elena Cruz"),
    ("necesito ver la historia clínica de la niña Ariana", "historia_clinica", "Ariana"),
    ("quiero ver las pruebas de laboratorio de Kevin Ortiz", "resultado_laboratorio", "Kevin Ortiz"),
    ("expediente de Gabriela Núñez porque está en emergencia", "historia_clinica", "Gabriela Núñez"),
    ("dame la receta de 87654321", "orden_medica", "87654321"),
    ("ver historial de Patricia León", "historia_clinica", "Patricia León"),
    ("consultar las órdenes de Ricardo Paz", "orden_medica", "Ricardo Paz"),
    ("necesito los resultados de la gestante Karina Vargas", "resultado_laboratorio", "Karina Vargas"),
    ("abrir la historia clínica del paciente Rodríguez", "historia_clinica", "Rodríguez"),
    ("muéstrame la ficha clínica de Daniela", "historia_clinica", "Daniela"),
    ("revisar la orden médica de Hugo Torres", "orden_medica", "Hugo Torres"),
]


def evaluar_nlp() -> dict:
    detalle, aciertos_doc, aciertos_pac, aciertos = [], 0, 0, 0
    for msg, tipo, paciente in FRASES_NLP:
        r = interpretar(msg)
        ok_doc = r["tipo_documento"] == tipo
        ok_pac = (r["paciente"] or "").lower() == paciente.lower()
        aciertos_doc += ok_doc
        aciertos_pac += ok_pac
        aciertos += ok_doc and ok_pac
        detalle.append({"mensaje": msg, "tipo": r["tipo_documento"], "paciente": r["paciente"], "correcto": ok_doc and ok_pac})
    n = len(FRASES_NLP)
    return {"total": n, "exactitud_documento": round(aciertos_doc / n, 4), "exactitud_paciente": round(aciertos_pac / n, 4),
            "exactitud_total": round(aciertos / n, 4), "errores": [d for d in detalle if not d["correcto"]]}


def main(desde_bd: bool = False):
    ejecucion = datetime.now().strftime("%Y%m%d-%H%M%S")
    if desde_bd:
        auditoria = Auditoria(DB_URL)
        esc = pd.read_sql("SELECT id_evento, grupo, rol_usuario, tipo_documento, relacion_paciente, hora_acceso, "
                          "autorizacion_excepcional, frecuencia_accesos, resultado_esperado, anomalia "
                          "FROM muestra_escenarios ORDER BY id_evento", auditoria.engine)
        print(f"Muestra leída de la base de datos: {len(esc)} escenarios ({auditoria.engine.url.get_backend_name()})")
    else:
        esc = pd.read_csv(DATA_DIR / "escenarios_evaluacion.csv")
        db = BASE_DIR / "evaluacion_auditoria.db"
        db.unlink(missing_ok=True)
        auditoria = Auditoria(f"sqlite:///{db}")
    agente = AgenteAcceso(auditoria)

    # calentamiento (la primera llamada carga librerías)
    agente.procesar_solicitud(0, "medico", "orden_medica", "medico_tratante", "10:00", False, 3, registrar=False)

    filas = []
    for r in esc.itertuples():
        res = agente.procesar_solicitud(
            usuario_id=1000 + r.Index, rol=r.rol_usuario, tipo_documento=r.tipo_documento,
            relacion_paciente=r.relacion_paciente, hora_acceso=r.hora_acceso,
            autorizacion_excepcional=bool(r.autorizacion_excepcional), frecuencia_accesos=int(r.frecuencia_accesos),
            solicitud_texto=f"prueba {ejecucion} escenario {r.id_evento}")
        filas.append({**r._asdict(), "id_log": res["id_log"], "decision_agente": res["decision"], "decision_arbol": res["decision_arbol"],
                      "score_anomalia": res["score_anomalia"], "nivel_alerta": res["nivel_alerta"],
                      "prob_legitimidad": res["prob_legitimidad"], "tiempo_ms": res["tiempo_respuesta_ms"]})
    df = pd.DataFrame(filas).drop(columns=["Index"])
    df.to_csv(REPORTS_DIR / "resultados_escenarios.csv", index=False)
    if desde_bd:
        resultados = df[["id_evento", "id_log", "decision_agente", "decision_arbol", "score_anomalia", "nivel_alerta",
                         "prob_legitimidad", "tiempo_ms"]].copy()
        resultados["correcto"] = (df["decision_agente"] == df["resultado_esperado"]).astype(int).values
        resultados["ejecucion"] = ejecucion
        resultados.to_sql("resultados_prueba", auditoria.engine, if_exists="append", index=False)
        print(f"Resultados guardados en la tabla resultados_prueba (ejecución {ejecucion})")

    normales = df[df["anomalia"] == 0]
    leg = df[df.grupo == "legitima"]
    noaut = df[df.grupo == "no_autorizada"]
    roles = df[df.grupo.str.startswith("rol_")]
    exc = df[df.grupo == "excepcional"]
    anom = df[df.grupo == "anomalia"]

    ids = [int(i) for i in df["id_log"].dropna()]
    with auditoria.Session() as s:
        registrados = s.query(AccessLog).filter(AccessLog.id_log.in_(ids)).count() if ids else 0

    cm = confusion_matrix(normales["resultado_esperado"].map(DECISIONES.index),
                          normales["decision_agente"].map(DECISIONES.index), labels=[0, 1, 2])
    nlp = evaluar_nlp()

    criterios = [
        ("Autorización correcta de accesos legítimos", "≥ 95 %", (leg.decision_agente == "AUTORIZAR").mean(), 0.95, len(leg)),
        ("Rechazo de accesos no autorizados", "≥ 95 %", (noaut.decision_agente == "RECHAZAR").mean(), 0.95, len(noaut)),
        ("Detección de accesos anómalos (recall)", "≥ 90 %", (anom.nivel_alerta != "NORMAL").mean(), 0.90, len(anom)),
        ("Control de roles diferenciados", "100 %", (roles.decision_agente == roles.resultado_esperado).mean(), 1.0, len(roles)),
        ("Manejo de casos excepcionales", "100 %", (exc.decision_agente == exc.resultado_esperado).mean(), 1.0, len(exc)),
        ("Tiempo de respuesta (máximo)", "< 500 ms", df.tiempo_ms.max(), None, len(df)),
        ("Completitud de la auditoría", "100 %", registrados / len(df), 1.0, len(df)),
        ("Interpretación del lenguaje natural", "≥ 90 %", nlp["exactitud_total"], 0.90, nlp["total"]),
    ]
    tabla = []
    for nombre, meta, valor, umbral, n in criterios:
        if umbral is None:
            cumple = valor < 500
            txt = f"{valor:.1f} ms (promedio {df.tiempo_ms.mean():.1f} ms)"
        else:
            cumple = valor >= umbral - 1e-9
            txt = f"{valor * 100:.1f} %"
        tabla.append({"criterio": nombre, "meta": meta, "resultado": txt, "n": int(n), "cumple": bool(cumple)})

    falsos_positivos = (normales.nivel_alerta != "NORMAL").mean()
    resumen = {
        "escenarios": int(len(df)),
        "criterios": tabla,
        "exactitud_agente_eventos_normales": round(float((normales.decision_agente == normales.resultado_esperado).mean()), 4),
        "matriz_confusion_agente": cm.tolist(),
        "alertas_en_eventos_normales": round(float(falsos_positivos), 4),
        "anomalias_criticas_bloqueadas": int((anom.nivel_alerta == "CRITICO").sum()),
        "anomalias_no_detectadas": int((anom.nivel_alerta == "NORMAL").sum()),
        "anomalias_finalmente_autorizadas": int((anom.decision_agente == "AUTORIZAR").sum()),
        "tiempo_ms": {"promedio": round(float(df.tiempo_ms.mean()), 2), "p95": round(float(np.percentile(df.tiempo_ms, 95)), 2),
                      "maximo": round(float(df.tiempo_ms.max()), 2)},
        "por_rol": {g: round(float((d.decision_agente == d.resultado_esperado).mean()), 4) for g, d in roles.groupby("grupo")},
        "errores_legitimas": leg[leg.decision_agente != "AUTORIZAR"][["id_evento", "rol_usuario", "tipo_documento",
                                                                      "relacion_paciente", "hora_acceso", "frecuencia_accesos",
                                                                      "decision_agente", "nivel_alerta"]].to_dict("records"),
        "errores_no_autorizadas": noaut[noaut.decision_agente != "RECHAZAR"][["id_evento", "rol_usuario", "tipo_documento",
                                                                               "relacion_paciente", "hora_acceso",
                                                                               "decision_agente"]].to_dict("records"),
        "nlp": nlp,
    }
    with open(REPORTS_DIR / "evaluacion_escenarios.json", "w", encoding="utf-8") as f:
        json.dump(resumen, f, ensure_ascii=False, indent=2, default=str)

    grafico_matriz(cm, ETIQUETAS, "Agente completo (escenarios normales)", "matriz_confusion_agente.png")

    print("=" * 78)
    print(f"{'Criterio':45s} {'Meta':10s} {'Resultado':24s} Cumple")
    print("-" * 78)
    for t in tabla:
        print(f"{t['criterio']:45s} {t['meta']:10s} {t['resultado']:24s} {'Sí' if t['cumple'] else 'No'}")
    print("=" * 78)
    print(f"Exactitud global del agente (eventos normales): {resumen['exactitud_agente_eventos_normales']:.2%}")
    print(f"Alertas en eventos normales (falsos positivos): {falsos_positivos:.2%}")
    print(f"Anomalías finalmente autorizadas por el agente: {resumen['anomalias_finalmente_autorizadas']} de {len(anom)}")
    if nlp["errores"]:
        print("Errores NLP:", nlp["errores"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluación del agente con la muestra de la Tabla 3")
    parser.add_argument("--bd", action="store_true", help="leer la muestra y guardar resultados en la base de datos")
    main(desde_bd=parser.parse_args().bd)
