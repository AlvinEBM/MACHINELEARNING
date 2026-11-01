"""
Entrenamiento y evaluación de los tres modelos del agente (secciones 2.3, 3.4 y 3.6 del informe).

  1. Árbol de Decisión       -> clasificación de permisos (modelo principal)
  2. Regresión Logística     -> probabilidad de legitimidad (modelo de comparación)
  3. Isolation Forest        -> detección de accesos anómalos (evaluado por separado)

Partición estratificada 70 % entrenamiento / 15 % validación / 15 % prueba.
Los modelos se serializan con pickle en models/ y las métricas y figuras se guardan en reports/.

Uso:  python -m src.entrenar
"""
import json
import pickle
import time
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)  # aviso de sklearn>=1.8 sobre el parámetro penalty

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score, roc_curve)
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, plot_tree

from .anomalia import NormalizadorAnomalia
from .config import (DATA_DIR, FIGURES_DIR, HIPER_ARBOL, HIPER_ISOLATION, HIPER_LOGISTICA, MODELS_DIR,
                     REPORTS_DIR, SEMILLA, UMBRAL_ANOMALIA_ADVERTENCIA)
from .preprocesamiento import (FEATURES_ARBOL, FEATURES_ISOLATION, FEATURES_LOGISTICA, NOMBRES_LEGIBLES,
                               Preprocesador, codificar_objetivo)
from .reglas import DECISIONES

ETIQUETAS = ["Rechazar", "Autorizar", "Requiere\naprobación"]
AZUL, NARANJA, TINTA, TINTA_2 = "#2a78d6", "#eb6834", "#0b0b0b", "#52514e"
CMAP = LinearSegmentedColormap.from_list("azules", ["#f0efec", "#9ec5f4", "#2a78d6", "#0d366b"])

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": "#c3c2b7", "axes.labelcolor": TINTA_2,
    "xtick.color": TINTA_2, "ytick.color": TINTA_2, "axes.titleweight": "bold", "axes.titlecolor": TINTA,
    "axes.spines.top": False, "axes.spines.right": False, "figure.dpi": 150,
})


def metricas_clasificacion(y_true, y_pred) -> dict:
    return {
        "exactitud": round(accuracy_score(y_true, y_pred), 4),
        "precision_macro": round(precision_score(y_true, y_pred, average="macro", zero_division=0), 4),
        "recall_macro": round(recall_score(y_true, y_pred, average="macro", zero_division=0), 4),
        "f1_macro": round(f1_score(y_true, y_pred, average="macro", zero_division=0), 4),
        "por_clase": classification_report(y_true, y_pred, labels=[0, 1, 2], target_names=DECISIONES,
                                           output_dict=True, zero_division=0),
        "matriz_confusion": confusion_matrix(y_true, y_pred, labels=[0, 1, 2]).tolist(),
    }


def grafico_matriz(cm, etiquetas, titulo, archivo):
    cm = np.array(cm)
    fig, ax = plt.subplots(figsize=(5.4, 4.3))
    ax.imshow(cm, cmap=CMAP)
    ax.set_xticks(range(len(etiquetas)), etiquetas)
    ax.set_yticks(range(len(etiquetas)), etiquetas)
    ax.set_xlabel("Decisión predicha")
    ax.set_ylabel("Decisión esperada")
    ax.set_title(titulo, fontsize=11, loc="left")
    umbral = cm.max() * 0.55
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, f"{cm[i, j]}", ha="center", va="center", fontsize=11,
                    color="white" if cm[i, j] > umbral else TINTA)
    ax.spines[:].set_visible(False)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / archivo)
    plt.close(fig)


def main():
    t0 = time.time()
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(DATA_DIR / "dataset_entrenamiento.csv")
    y = codificar_objetivo(df["resultado_esperado"])

    # ---------------- partición 70/15/15 estratificada ----------------
    idx = np.arange(len(df))
    idx_tr, idx_tmp = train_test_split(idx, test_size=0.30, stratify=y, random_state=SEMILLA)
    idx_va, idx_te = train_test_split(idx_tmp, test_size=0.50, stratify=y[idx_tmp], random_state=SEMILLA)
    df_tr, df_va, df_te = df.iloc[idx_tr], df.iloc[idx_va], df.iloc[idx_te]
    y_tr, y_va, y_te = y[idx_tr], y[idx_va], y[idx_te]

    prep = Preprocesador().fit(df_tr)
    X_tr, X_va, X_te = prep.transform(df_tr), prep.transform(df_va), prep.transform(df_te)
    X_tr.assign(objetivo=y_tr).head(8).to_csv(REPORTS_DIR / "muestra_dataset_procesado.csv", index=False)

    # ---------------- 1) Árbol de Decisión ----------------
    arbol = DecisionTreeClassifier(**HIPER_ARBOL).fit(X_tr[FEATURES_ARBOL], y_tr)

    # Curva de validación de max_depth (selección de la configuración con el conjunto de validación)
    curva = []
    for prof in [2, 3, 4, 5, 6, 7, 8, 10]:
        m = DecisionTreeClassifier(**{**HIPER_ARBOL, "max_depth": prof}).fit(X_tr[FEATURES_ARBOL], y_tr)
        curva.append({"max_depth": prof,
                      "f1_entrenamiento": round(f1_score(y_tr, m.predict(X_tr[FEATURES_ARBOL]), average="macro"), 4),
                      "f1_validacion": round(f1_score(y_va, m.predict(X_va[FEATURES_ARBOL]), average="macro"), 4)})

    # ---------------- 2) Regresión Logística ----------------
    logistica = LogisticRegression(**HIPER_LOGISTICA).fit(X_tr[FEATURES_LOGISTICA], y_tr)

    # ---------------- 3) Isolation Forest (no supervisado: no usa la etiqueta) ----------------
    iso = IsolationForest(**HIPER_ISOLATION).fit(X_tr[FEATURES_ISOLATION])
    normalizador = NormalizadorAnomalia().fit(iso, X_tr[FEATURES_ISOLATION])

    # ---------------- Métricas ----------------
    res = {"particion": {"entrenamiento": len(df_tr), "validacion": len(df_va), "prueba": len(df_te)},
           "distribucion_clases": df["resultado_esperado"].value_counts().to_dict(),
           "tasa_anomalias": round(float(df["anomalia"].mean()), 4)}

    for nombre, modelo, feats in [("arbol_decision", arbol, FEATURES_ARBOL),
                                  ("regresion_logistica", logistica, FEATURES_LOGISTICA)]:
        res[nombre] = {
            "entrenamiento": metricas_clasificacion(y_tr, modelo.predict(X_tr[feats])),
            "validacion": metricas_clasificacion(y_va, modelo.predict(X_va[feats])),
            "prueba": metricas_clasificacion(y_te, modelo.predict(X_te[feats])),
        }
    proba_te = logistica.predict_proba(X_te[FEATURES_LOGISTICA])
    res["regresion_logistica"]["prueba"]["roc_auc_ovr"] = round(roc_auc_score(y_te, proba_te, multi_class="ovr"), 4)
    res["arbol_decision"]["curva_validacion_max_depth"] = curva
    res["arbol_decision"]["profundidad_real"] = int(arbol.get_depth())
    res["arbol_decision"]["hojas"] = int(arbol.get_n_leaves())
    res["arbol_decision"]["importancia_atributos"] = {
        f: round(float(v), 4) for f, v in sorted(zip(FEATURES_ARBOL, arbol.feature_importances_), key=lambda t: -t[1]) if v > 0
    }
    res["regresion_logistica"]["coeficientes_autorizar"] = {
        f: round(float(c), 4) for f, c in zip(FEATURES_LOGISTICA, logistica.coef_[1])
    }

    anom_te = df_te["anomalia"].values
    score_te = normalizador.puntaje(iso, X_te[FEATURES_ISOLATION])
    pred_anom = (score_te >= UMBRAL_ANOMALIA_ADVERTENCIA).astype(int)
    tn, fp, fn, tp = confusion_matrix(anom_te, pred_anom, labels=[0, 1]).ravel()
    res["isolation_forest"] = {
        "prueba": {
            "recall_deteccion": round(tp / max(tp + fn, 1), 4),
            "precision": round(tp / max(tp + fp, 1), 4),
            "f1": round(f1_score(anom_te, pred_anom), 4),
            "tasa_falsos_positivos": round(fp / max(fp + tn, 1), 4),
            "roc_auc": round(roc_auc_score(anom_te, score_te), 4),
            "matriz_confusion": [[int(tn), int(fp)], [int(fn), int(tp)]],
        },
        "umbral_modelo_s": round(normalizador.s_umbral, 4),
    }
    res["tiempo_entrenamiento_s"] = round(time.time() - t0, 2)

    # ---------------- Guardar modelos (pickle) ----------------
    for nombre, obj in [("arbol_decision", arbol), ("regresion_logistica", logistica),
                        ("isolation_forest", iso), ("preprocesador", prep), ("normalizador_anomalia", normalizador)]:
        with open(MODELS_DIR / f"{nombre}.pkl", "wb") as f:
            pickle.dump(obj, f)
    with open(REPORTS_DIR / "metricas_modelos.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    # ---------------- Figuras para el informe ----------------
    grafico_matriz(res["arbol_decision"]["prueba"]["matriz_confusion"], ETIQUETAS,
                   "Árbol de Decisión (conjunto de prueba)", "matriz_confusion_arbol.png")
    grafico_matriz(res["regresion_logistica"]["prueba"]["matriz_confusion"], ETIQUETAS,
                   "Regresión Logística (conjunto de prueba)", "matriz_confusion_logistica.png")
    grafico_matriz(res["isolation_forest"]["prueba"]["matriz_confusion"], ["Normal", "Anómalo"],
                   "Isolation Forest (conjunto de prueba)", "matriz_confusion_isolation.png")

    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    fpr, tpr, _ = roc_curve(anom_te, score_te)
    ax.plot(fpr, tpr, color=AZUL, lw=2, label=f"Isolation Forest (AUC = {res['isolation_forest']['prueba']['roc_auc']:.3f})")
    fpr2, tpr2, _ = roc_curve((y_te == 1).astype(int), proba_te[:, 1])
    auc2 = roc_auc_score((y_te == 1).astype(int), proba_te[:, 1])
    ax.plot(fpr2, tpr2, color=NARANJA, lw=2, label=f"Regresión Logística, clase Autorizar (AUC = {auc2:.3f})")
    ax.plot([0, 1], [0, 1], color="#c3c2b7", lw=1, ls="--")
    ax.set_xlabel("Tasa de falsos positivos")
    ax.set_ylabel("Tasa de verdaderos positivos")
    ax.set_title("Curvas ROC en el conjunto de prueba", fontsize=11, loc="left")
    ax.legend(loc="lower right", frameon=False, fontsize=8)
    ax.grid(color="#ecebe7", lw=0.6)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "curvas_roc.png")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5.2, 3.6))
    p = [c["max_depth"] for c in curva]
    ax.plot(p, [c["f1_entrenamiento"] for c in curva], color=AZUL, lw=2, marker="o", ms=5, label="Entrenamiento")
    ax.plot(p, [c["f1_validacion"] for c in curva], color=NARANJA, lw=2, marker="o", ms=5, label="Validación")
    ax.axvline(7, color="#c3c2b7", lw=1, ls="--")
    ax.set_xlabel("max_depth")
    ax.set_ylabel("F1-score (macro)")
    ax.set_title("Árbol de Decisión: curva de validación", fontsize=11, loc="left")
    ax.legend(frameon=False)
    ax.grid(color="#ecebe7", lw=0.6)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "curva_validacion_arbol.png")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(12, 5.2))
    plot_tree(arbol, max_depth=2, feature_names=[NOMBRES_LEGIBLES.get(f, f) for f in FEATURES_ARBOL],
              class_names=["Rechazar", "Autorizar", "Requiere aprob."], filled=False, impurity=False,
              proportion=True, precision=2, fontsize=10, ax=ax)
    ax.set_title("Árbol de Decisión entrenado (primeros niveles)", fontsize=12, loc="left")
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "arbol_decision.png")
    plt.close(fig)

    imp = res["arbol_decision"]["importancia_atributos"]
    fig, ax = plt.subplots(figsize=(6.6, 3.6))
    nombres = [NOMBRES_LEGIBLES.get(k, k) for k in imp][::-1]
    ax.barh(nombres, list(imp.values())[::-1], color=AZUL, height=0.6)
    ax.set_xlabel("Importancia (reducción de Gini)")
    ax.set_title("Árbol de Decisión: importancia de atributos", fontsize=11, loc="left")
    ax.grid(axis="x", color="#ecebe7", lw=0.6)
    fig.tight_layout()
    fig.savefig(FIGURES_DIR / "importancia_atributos.png")
    plt.close(fig)

    # ---------------- Resumen en consola ----------------
    print("=" * 64)
    print(f"Partición  -> {res['particion']}")
    for n in ("arbol_decision", "regresion_logistica"):
        m = res[n]["prueba"]
        print(f"{n:22s} exactitud={m['exactitud']:.4f}  precisión={m['precision_macro']:.4f}  "
              f"recall={m['recall_macro']:.4f}  F1={m['f1_macro']:.4f}")
    i = res["isolation_forest"]["prueba"]
    print(f"{'isolation_forest':22s} recall={i['recall_deteccion']:.4f}  precisión={i['precision']:.4f}  "
          f"F1={i['f1']:.4f}  FPR={i['tasa_falsos_positivos']:.4f}  AUC={i['roc_auc']:.4f}")
    print(f"Modelos guardados en {MODELS_DIR}")
    print("=" * 64)


if __name__ == "__main__":
    main()
