"""
Análisis complementario para el capítulo IV del informe.

  1. Validación cruzada estratificada de 5 particiones (estabilidad de los modelos).
  2. Análisis de errores del Árbol de Decisión en el conjunto de prueba.
  3. Comparación del agente con dos líneas base sobre los escenarios de la Tabla 3:
       - Situación actual: sin control de acceso (todo usuario autenticado accede).
       - RBAC estático: permisos solo por rol, sin relación con el paciente ni análisis de comportamiento.
  4. Figuras compuestas para el informe.

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
from sklearn.metrics import accuracy_score, f1_score, recall_score
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


def main():
    df = pd.read_csv(DATA_DIR / "dataset_entrenamiento.csv")
    res = {"validacion_cruzada_5": validacion_cruzada(df), "analisis_errores_arbol": analisis_errores(df),
           "lineas_base": lineas_base()}
    with open(REPORTS_DIR / "analisis_resultados.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    figura_compuesta(["matriz_confusion_arbol.png", "matriz_confusion_logistica.png", "matriz_confusion_isolation.png"],
                     "compuesta_matrices.png")
    figura_compuesta(["curva_validacion_arbol.png", "curvas_roc.png"], "compuesta_validacion_roc.png", 2000)
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
