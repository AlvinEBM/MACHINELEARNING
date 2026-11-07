"""
Análisis complementario para el capítulo IV del informe.

  1. Validación cruzada estratificada de 5 particiones (estabilidad de los modelos).
  2. Análisis de errores del Árbol de Decisión en el conjunto de prueba.
  3. Comparación del agente con dos líneas base sobre los escenarios de la Tabla 3:
       - Situación actual: sin control de acceso (todo usuario autenticado accede).
       - RBAC estático: permisos solo por rol, sin relación con el paciente ni análisis de comportamiento.
  4. Figuras compuestas para el informe.
  5. Verificación de las métricas idénticas del Árbol y la Regresión Logística (techo por ruido de registro).
  6. Evaluación del agente completo sobre el conjunto de prueba de 1 192 eventos (con ruido y anomalías).

Requiere haber ejecutado antes: generar_dataset, entrenar y evaluar.
Uso:  python -m src.analisis_resultados
"""
import json
import warnings

import numpy as np
import pandas as pd
from PIL import Image
from sklearn.base import clone
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, log_loss, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.tree import DecisionTreeClassifier

from .anomalia import NormalizadorAnomalia
from .config import (DATA_DIR, FIGURES_DIR, HIPER_ARBOL, HIPER_ISOLATION, HIPER_LOGISTICA, REPORTS_DIR, SEMILLA,
                     UMBRAL_ANOMALIA_ADVERTENCIA)
from .preprocesamiento import (FEATURES_ARBOL, FEATURES_ISOLATION, FEATURES_LOGISTICA, Preprocesador,
                               codificar_objetivo, hora_a_decimal)
from .reglas import decision_esperada

warnings.filterwarnings("ignore", category=FutureWarning)


def validacion_cruzada(df: pd.DataFrame, k: int = 5) -> dict:
    y = codificar_objetivo(df["resultado_esperado"])
    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=SEMILLA)
    res = {"arbol_decision": [], "regresion_logistica": [], "isolation_forest_recall": [], "isolation_forest_fpr": []}
    for tr, te in skf.split(df, y):
        prep = Preprocesador().fit(df.iloc[tr])
        Xtr, Xte = prep.transform(df.iloc[tr]), prep.transform(df.iloc[te])
        for nombre, modelo, feats in [("arbol_decision", DecisionTreeClassifier(**HIPER_ARBOL), FEATURES_ARBOL),
                                      ("regresion_logistica", LogisticRegression(**HIPER_LOGISTICA), FEATURES_LOGISTICA)]:
            m = clone(modelo).fit(Xtr[feats], y[tr])
            p = m.predict(Xte[feats])
            res[nombre].append({"exactitud": accuracy_score(y[te], p), "f1": f1_score(y[te], p, average="macro")})
        iso = IsolationForest(**HIPER_ISOLATION).fit(Xtr[FEATURES_ISOLATION])
        s = NormalizadorAnomalia().fit(iso, Xtr[FEATURES_ISOLATION]).puntaje(iso, Xte[FEATURES_ISOLATION])
        anom = df.iloc[te]["anomalia"].values == 1
        alerta = s >= UMBRAL_ANOMALIA_ADVERTENCIA
        res["isolation_forest_recall"].append(alerta[anom].mean())
        res["isolation_forest_fpr"].append(alerta[~anom].mean())

    def resumen(vals):
        return {"media": round(float(np.mean(vals)), 4), "desv": round(float(np.std(vals)), 4),
                "min": round(float(np.min(vals)), 4), "max": round(float(np.max(vals)), 4)}

    out = {}
    for n in ("arbol_decision", "regresion_logistica"):
        out[n] = {"exactitud": resumen([r["exactitud"] for r in res[n]]), "f1": resumen([r["f1"] for r in res[n]])}
    out["isolation_forest"] = {"recall": resumen(res["isolation_forest_recall"]),
                               "tasa_falsos_positivos": resumen(res["isolation_forest_fpr"])}
    return out


def analisis_errores(df: pd.DataFrame) -> dict:
    """Errores del Árbol en prueba: ¿se deben a eventos con la relación mal registrada?"""
    import pickle
    from .config import MODELS_DIR
    y = codificar_objetivo(df["resultado_esperado"])
    idx = np.arange(len(df))
    _, idx_tmp = train_test_split(idx, test_size=0.30, stratify=y, random_state=SEMILLA)
    _, idx_te = train_test_split(idx_tmp, test_size=0.50, stratify=y[idx_tmp], random_state=SEMILLA)
    te = df.iloc[idx_te].copy()
    arbol = pickle.load(open(MODELS_DIR / "arbol_decision.pkl", "rb"))
    prep = pickle.load(open(MODELS_DIR / "preprocesador.pkl", "rb"))
    pred = arbol.predict(prep.transform(te)[FEATURES_ARBOL])
    te["error"] = pred != y[idx_te]
    # un evento tiene "ruido de registro" si la matriz aplicada a lo registrado no coincide con la etiqueta
    te["ruido"] = [
        decision_esperada(r.rol_usuario, r.tipo_documento, r.relacion_paciente, hora_a_decimal(r.hora_acceso),
                          r.autorizacion_excepcional) != r.resultado_esperado
        for r in te.itertuples()
    ]
    err = te[te.error]
    return {
        "eventos_prueba": int(len(te)),
        "errores": int(te.error.sum()),
        "eventos_con_ruido": int(te.ruido.sum()),
        "errores_en_eventos_con_ruido": int((te.error & te.ruido).sum()),
        "errores_en_eventos_limpios": int((te.error & ~te.ruido).sum()),
        "exactitud_eventos_limpios": round(float(1 - te[~te.ruido].error.mean()), 4),
        "errores_por_rol": err["rol_usuario"].value_counts().to_dict(),
    }


def lineas_base() -> dict:
    """Compara el agente con la situación actual y con un RBAC estático por rol."""
    esc = pd.read_csv(REPORTS_DIR / "resultados_escenarios.csv")
    rbac_rol = {"medico": "AUTORIZAR", "enfermeria": "AUTORIZAR", "administrativo": "RECHAZAR",
                "administrador": "REQUIERE_APROBACION"}
    esc["sin_control"] = "AUTORIZAR"
    esc["rbac_estatico"] = esc["rol_usuario"].map(rbac_rol)
    normales = esc[esc.anomalia == 0]
    anom = esc[esc.anomalia == 1]
    legit = esc[esc.grupo == "legitima"]
    noaut = esc[esc.grupo == "no_autorizada"]
    out = {}
    for nombre, col in [("sin_control", "sin_control"), ("rbac_estatico", "rbac_estatico"), ("agente_ia", "decision_agente")]:
        out[nombre] = {
            "exactitud_eventos_normales": round(float((normales[col] == normales.resultado_esperado).mean()), 4),
            "autorizacion_legitimos": round(float((legit[col] == "AUTORIZAR").mean()), 4),
            "rechazo_no_autorizados": round(float((noaut[col] == "RECHAZAR").mean()), 4),
            "anomalias_autorizadas": int((anom[col] == "AUTORIZAR").sum()),
            "anomalias_detectadas": int((anom.nivel_alerta != "NORMAL").sum()) if col == "decision_agente" else 0,
        }
    out["n_normales"], out["n_anomalias"] = int(len(normales)), int(len(anom))
    out["anomalias_detenidas_agente"] = int((anom.decision_agente != "AUTORIZAR").sum())
    return out


def figura_compuesta(archivos: list[str], salida: str, ancho_max: int = 2400):
    imgs = [Image.open(FIGURES_DIR / a).convert("RGB") for a in archivos]
    h = max(i.height for i in imgs)
    imgs = [i.resize((int(i.width * h / i.height), h)) for i in imgs]
    lienzo = Image.new("RGB", (sum(i.width for i in imgs), h), "white")
    x = 0
    for i in imgs:
        lienzo.paste(i, (x, 0))
        x += i.width
    if lienzo.width > ancho_max:
        lienzo = lienzo.resize((ancho_max, int(lienzo.height * ancho_max / lienzo.width)))
    lienzo.save(FIGURES_DIR / salida)


def _particiones(df: pd.DataFrame):
    y = codificar_objetivo(df["resultado_esperado"])
    idx = np.arange(len(df))
    tr, tmp = train_test_split(idx, test_size=0.30, stratify=y, random_state=SEMILLA)
    va, te = train_test_split(tmp, test_size=0.50, stratify=y[tmp], random_state=SEMILLA)
    return y, {"entrenamiento": tr, "validacion": va, "prueba": te}


def _ruido(df: pd.DataFrame) -> np.ndarray:
    """True si la matriz aplicada a los datos registrados no coincide con la etiqueta (relación mal registrada)."""
    return np.array([
        decision_esperada(r.rol_usuario, r.tipo_documento, r.relacion_paciente, hora_a_decimal(r.hora_acceso),
                          r.autorizacion_excepcional) != r.resultado_esperado
        for r in df.itertuples()
    ])


def verificacion_modelos(df: pd.DataFrame) -> dict:
    """¿Por qué el Árbol y la Regresión Logística tienen métricas idénticas?"""
    import pickle
    from .config import MODELS_DIR
    from .reglas import DECISIONES
    cargar = lambda n: pickle.load(open(MODELS_DIR / f"{n}.pkl", "rb"))
    arbol, logistica, prep = cargar("arbol_decision"), cargar("regresion_logistica"), cargar("preprocesador")
    y, parts = _particiones(df)
    ruido = _ruido(df)
    regla = np.array([DECISIONES.index(decision_esperada(r.rol_usuario, r.tipo_documento, r.relacion_paciente,
                                                         hora_a_decimal(r.hora_acceso), r.autorizacion_excepcional))
                      for r in df.itertuples()])
    out = {}
    for nombre, ix in parts.items():
        X = prep.transform(df.iloc[ix])
        pa, pl = arbol.predict(X[FEATURES_ARBOL]), logistica.predict(X[FEATURES_LOGISTICA])
        proba_a, proba_l = arbol.predict_proba(X[FEATURES_ARBOL]), logistica.predict_proba(X[FEATURES_LOGISTICA])
        out[nombre] = {
            "eventos": int(len(ix)), "eventos_con_ruido": int(ruido[ix].sum()),
            "exactitud_maxima_alcanzable": round(float(1 - ruido[ix].mean()), 4),
            "exactitud_arbol": round(accuracy_score(y[ix], pa), 4),
            "exactitud_logistica": round(accuracy_score(y[ix], pl), 4),
            "predicciones_coincidentes": round(float((pa == pl).mean()), 4),
            "arbol_reproduce_la_matriz": round(float((pa == regla[ix]).mean()), 4),
            "errores_arbol_en_eventos_con_ruido": int(((pa != y[ix]) & ruido[ix]).sum()),
            "roc_auc_arbol": round(roc_auc_score(y[ix], proba_a, multi_class="ovr"), 4),
            "roc_auc_logistica": round(roc_auc_score(y[ix], proba_l, multi_class="ovr"), 4),
            "log_loss_arbol": round(log_loss(y[ix], np.clip(proba_a, 1e-15, 1)), 4),
            "log_loss_logistica": round(log_loss(y[ix], proba_l), 4),
        }
    return out


def agente_en_prueba(df: pd.DataFrame) -> dict:
    """Agente completo (tres fases) sobre el conjunto de prueba aleatorio, que sí contiene ruido de registro."""
    from .agente import AgenteAcceso
    from .auditoria import Auditoria
    _, parts = _particiones(df)
    te = df.iloc[parts["prueba"]].copy()
    te["ruido"] = _ruido(te)
    agente = AgenteAcceso(Auditoria("sqlite://"))
    te["decision"] = [agente.procesar_solicitud(1, r.rol_usuario, r.tipo_documento, r.relacion_paciente, r.hora_acceso,
                                                bool(r.autorizacion_excepcional), int(r.frecuencia_accesos),
                                                registrar=False)["decision"] for r in te.itertuples()]
    n, a = te[te.anomalia == 0], te[te.anomalia == 1]
    ok = n.decision == n.resultado_esperado
    return {
        "eventos": int(len(te)), "normales": int(len(n)), "anomalos": int(len(a)),
        "exactitud_normales": round(float(ok.mean()), 4), "errores_normales": int((~ok).sum()),
        "errores_normales_con_ruido": int(((~ok) & n.ruido).sum()),
        "exactitud_normales_sin_ruido": round(float(ok[~n.ruido].mean()), 4),
        "autorizacion_legitimos": round(float((n[n.resultado_esperado == "AUTORIZAR"].decision == "AUTORIZAR").mean()), 4),
        "rechazo_no_autorizados": round(float((n[n.resultado_esperado == "RECHAZAR"].decision == "RECHAZAR").mean()), 4),
        "anomalias_autorizadas": int((a.decision == "AUTORIZAR").sum()),
    }


def main():
    df = pd.read_csv(DATA_DIR / "dataset_entrenamiento.csv")
    res = {"validacion_cruzada_5": validacion_cruzada(df), "analisis_errores_arbol": analisis_errores(df),
           "lineas_base": lineas_base(), "verificacion_modelos": verificacion_modelos(df),
           "agente_en_prueba": agente_en_prueba(df)}
    with open(REPORTS_DIR / "analisis_resultados.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    figura_compuesta(["matriz_confusion_arbol.png", "matriz_confusion_logistica.png", "matriz_confusion_isolation.png"],
                     "compuesta_matrices.png")
    figura_compuesta(["curva_validacion_arbol.png", "curvas_roc.png"], "compuesta_validacion_roc.png", 2000)
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
