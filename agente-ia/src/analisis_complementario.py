"""
Análisis complementarios solicitados en la revisión del informe.

  1. Auditoría de la generación del dataset: tipos de anomalía, eventos con la relación alterada
     (3 % de 8 000 eventos generados) y cuántos de ellos cambian la decisión, por partición.
  2. Construcción de la muestra experimental de 330 escenarios.
  3. Contribución individual de cada modelo (ablación): Árbol solo, Árbol + Isolation Forest,
     Árbol + Regresión Logística y agente completo.
  4. Sensibilidad de los umbrales de Isolation Forest (advertencia / crítico) y de la Regresión
     Logística (autorizar / aprobación), evaluada en el conjunto de VALIDACIÓN.
  5. Desglose de las 100 anomalías de la muestra: detección, rechazo por permisos y bloqueo final.

Uso:  python -m src.analisis_complementario      (genera reports/analisis_complementario.json)
"""
import json
import pickle

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from .config import DATA_DIR, MODELS_DIR, REPORTS_DIR, SEMILLA
from .generar_dataset import (MAX_FRECUENCIA_NORMAL, PESO_DOCUMENTO, PESO_RELACION, PESO_ROL,
                              PROB_GUARDIA_NOCTURNA, _elegir, _evento_normal)
from .preprocesamiento import FEATURES_ARBOL, FEATURES_ISOLATION, FEATURES_LOGISTICA, codificar_objetivo, hora_a_decimal
from .reglas import DECISIONES, decision_esperada

RECH, AUT, REQ = 0, 1, 2
UMBRALES_ACTUALES = {"adv": 0.70, "crit": 0.85, "aut": 0.90, "apr": 0.60}


# ---------------------------------------------------------------- 1. auditoría de la generación
def _evento_anomalo_con_tipo(rng):
    """Misma secuencia aleatoria que generar_dataset._evento_anomalo, pero devuelve el tipo."""
    e = _evento_normal(rng)
    tipo = rng.choice(["masivo", "madrugada", "curioseo"], p=[0.40, 0.30, 0.30])
    if tipo == "masivo":
        e["frecuencia_accesos"] = int(rng.integers(35, 91))
    elif tipo == "madrugada":
        e["rol_usuario"] = rng.choice(["administrativo", "administrador", "medico"], p=[0.4, 0.3, 0.3])
        e["relacion_paciente"] = "sin_relacion" if e["rol_usuario"] != "administrativo" or rng.random() < 0.7 else "personal_apoyo"
        e["hora"] = round(rng.uniform(0.0, 5.5) * 60) / 60
        e["frecuencia_accesos"] = int(rng.integers(12, 30))
    else:
        e["relacion_paciente"] = "sin_relacion"
        if e["rol_usuario"] == "medico" and rng.random() < 0.5:
            e["rol_usuario"] = "enfermeria"
        e["tipo_documento"] = "historia_clinica"
        e["frecuencia_accesos"] = int(rng.integers(26, 46))
    e["anomalia"] = 1
    return e, str(tipo)


def reconstruir_generacion(n=8000, tasa_anomalia=0.10, ruido_registro=0.03, semilla=SEMILLA) -> pd.DataFrame:
    rng = np.random.default_rng(semilla)
    filas, tipos = [], []
    for _ in range(n):
        if rng.random() < tasa_anomalia:
            e, t = _evento_anomalo_con_tipo(rng)
        else:
            e, t = _evento_normal(rng), "normal"
        filas.append(e)
        tipos.append(t)
    df = pd.DataFrame(filas)
    df["tipo_anomalia"] = tipos
    df["resultado_esperado"] = [decision_esperada(r.rol_usuario, r.tipo_documento, r.relacion_paciente, r.hora,
                                                  r.autorizacion_excepcional) for r in df.itertuples()]
    df["relacion_real"] = df["relacion_paciente"]
    afectados = rng.random(len(df)) < ruido_registro
    for i in np.where(afectados)[0]:
        actual = df.iloc[i]["relacion_paciente"]
        opciones = [r for r in ("medico_tratante", "personal_apoyo", "sin_relacion")
                    if r != actual and (r != "medico_tratante" or df.iloc[i]["rol_usuario"] == "medico")]
        df.iloc[i, df.columns.get_loc("relacion_paciente")] = rng.choice(opciones)
    df["relacion_alterada"] = afectados
    df["hora_acceso"] = df["hora"].apply(lambda h: f"{int(h) % 24:02d}:{int(round((h % 1) * 60)) % 60:02d}")
    return df


def _particiones(df):
    y = codificar_objetivo(df["resultado_esperado"])
    idx = np.arange(len(df))
    tr, tmp = train_test_split(idx, test_size=0.30, stratify=y, random_state=SEMILLA)
    va, te = train_test_split(tmp, test_size=0.50, stratify=y[tmp], random_state=SEMILLA)
    return {"entrenamiento": tr, "validacion": va, "prueba": te}


def auditoria_generacion() -> dict:
    gen = reconstruir_generacion()
    columnas = ["rol_usuario", "tipo_documento", "relacion_paciente", "hora_acceso", "autorizacion_excepcional",
                "frecuencia_accesos", "resultado_esperado", "anomalia"]
    dedup = gen.drop_duplicates(subset=columnas).reset_index(drop=True)
    real = pd.read_csv(DATA_DIR / "dataset_entrenamiento.csv")
    identico = bool((dedup[columnas].astype(str).values == real[columnas].astype(str).values).all())
    dedup["decision_afectada"] = [decision_esperada(r.rol_usuario, r.tipo_documento, r.relacion_paciente,
                                                    hora_a_decimal(r.hora_acceso), r.autorizacion_excepcional)
                                  != r.resultado_esperado for r in dedup.itertuples()]
    out = {"generados": len(gen), "tras_eliminar_duplicados": len(dedup), "reproduce_dataset_publicado": identico,
           "anomalos_generados": int((gen.anomalia == 1).sum()),
           "tipos_anomalia": dedup[dedup.anomalia == 1]["tipo_anomalia"].value_counts().to_dict(),
           "relacion_alterada_generados": int(gen.relacion_alterada.sum()),
           "relacion_alterada_dataset": int(dedup.relacion_alterada.sum()),
           "decision_afectada_dataset": int(dedup.decision_afectada.sum()),
           "roles": dedup.rol_usuario.value_counts().to_dict(),
           "guardia_nocturna_normales": int(((dedup.anomalia == 0) & dedup.hora_acceso.str[:2].astype(int).isin(
               [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6])).sum()),
           "particiones": {}}
    for nombre, ix in _particiones(dedup).items():
        p = dedup.iloc[ix]
        out["particiones"][nombre] = {"eventos": int(len(p)), "relacion_alterada": int(p.relacion_alterada.sum()),
                                      "pct_alterada": round(float(p.relacion_alterada.mean()), 4),
                                      "decision_afectada": int(p.decision_afectada.sum()),
                                      "pct_afectada": round(float(p.decision_afectada.mean()), 4),
                                      "anomalias": int(p.anomalia.sum())}
    tot = dedup
    out["particiones"]["total"] = {"eventos": int(len(tot)), "relacion_alterada": int(tot.relacion_alterada.sum()),
                                   "pct_alterada": round(float(tot.relacion_alterada.mean()), 4),
                                   "decision_afectada": int(tot.decision_afectada.sum()),
                                   "pct_afectada": round(float(tot.decision_afectada.mean()), 4),
                                   "anomalias": int(tot.anomalia.sum())}
    return out


# ---------------------------------------------------------------- 2. muestra experimental
def muestra_experimental() -> dict:
    esc = pd.read_csv(DATA_DIR / "escenarios_evaluacion.csv")
    ent = pd.read_csv(DATA_DIR / "dataset_entrenamiento.csv")
    clave = ["rol_usuario", "tipo_documento", "relacion_paciente", "hora_acceso", "autorizacion_excepcional", "frecuencia_accesos"]
    vistos = set(map(tuple, ent[clave].astype(str).values))
    repetidos = int(sum(tuple(r) in vistos for r in esc[clave].astype(str).values))
    comb = ["rol_usuario", "tipo_documento", "relacion_paciente", "autorizacion_excepcional"]
    comb_ent = set(map(tuple, ent[comb].astype(str).values))
    comb_esc = set(map(tuple, esc[comb].astype(str).values))
    return {"grupos": esc.grupo.value_counts().to_dict(),
            "decision_por_grupo": {g: d.resultado_esperado.value_counts().to_dict() for g, d in esc.groupby("grupo")},
            "eventos_identicos_a_entrenamiento": repetidos,
            "combinaciones_categoricas_en_escenarios": len(comb_esc),
            "combinaciones_categoricas_nuevas": len(comb_esc - comb_ent)}


# ---------------------------------------------------------------- 3-5. decisiones vectorizadas
def _componentes(df):
    cargar = lambda n: pickle.load(open(MODELS_DIR / f"{n}.pkl", "rb"))
    arbol, logistica, iso, norm, prep = (cargar(n) for n in ("arbol_decision", "regresion_logistica",
                                                             "isolation_forest", "normalizador_anomalia", "preprocesador"))
    X = prep.transform(df)
    d_arb = arbol.predict(X[FEATURES_ARBOL]).astype(int)
    score = norm.puntaje(iso, X[FEATURES_ISOLATION])
    proba = logistica.predict_proba(X[FEATURES_LOGISTICA])
    legit = proba[:, AUT] + 0.75 * proba[:, REQ]
    return d_arb, np.asarray(score), legit


def decidir(d_arb, score, legit, config="completo", u=UMBRALES_ACTUALES):
    d = d_arb.copy()
    adv, crit = score >= u["adv"], score > u["crit"]
    if config == "arbol":
        return d
    if config == "arbol_if":
        d = np.where((d_arb != RECH) & crit, RECH, d)
        d = np.where((d_arb != RECH) & ~crit & adv, REQ, d)
        return d
    if config == "arbol_rl":
        amb = d_arb == REQ
        d = np.where(amb & (legit > u["aut"]), AUT, d)
        d = np.where(amb & (legit <= u["aut"]) & (legit >= u["apr"]), REQ, d)
        d = np.where(amb & (legit < u["apr"]), RECH, d)
        return d
    # agente completo (Algoritmo 1)
    noR = d_arb != RECH
    d = np.where(noR & crit, RECH, d)
    amb = noR & ~crit & ((d_arb == REQ) | adv)
    d = np.where(amb & (legit > u["aut"]) & ~adv, AUT, d)
    d = np.where(amb & ~((legit > u["aut"]) & ~adv) & (legit >= u["apr"]), REQ, d)
    d = np.where(amb & ~((legit > u["aut"]) & ~adv) & (legit < u["apr"]), RECH, d)
    return d


def metricas(d, y, anom):
    n = anom == 0
    a = anom == 1
    return {"exactitud_normales": round(float((d[n] == y[n]).mean()), 4),
            "autorizaciones_indebidas": int(((d == AUT) & (y != AUT) & n).sum()),
            "legitimos_no_autorizados": int(((d != AUT) & (y == AUT) & n).sum()),
            "derivadas_a_aprobacion_pct": round(float((d == REQ).mean()), 4),
            "anomalias_autorizadas": int(((d == AUT) & a).sum()),
            "anomalias_rechazadas": int(((d == RECH) & a).sum()),
            "anomalias_derivadas": int(((d == REQ) & a).sum()),
            "normales": int(n.sum()), "anomalias": int(a.sum())}


def _conjuntos():
    ent = pd.read_csv(DATA_DIR / "dataset_entrenamiento.csv")
    parts = _particiones(ent)
    esc = pd.read_csv(DATA_DIR / "escenarios_evaluacion.csv")
    return {"validacion": ent.iloc[parts["validacion"]].reset_index(drop=True),
            "prueba": ent.iloc[parts["prueba"]].reset_index(drop=True), "muestra_330": esc}


def ablacion() -> dict:
    out = {}
    for nombre, df in _conjuntos().items():
        if nombre == "validacion":
            continue
        y = codificar_objetivo(df["resultado_esperado"])
        comp = _componentes(df)
        out[nombre] = {c: metricas(decidir(*comp, config=c), y, df["anomalia"].values)
                       for c in ("arbol", "arbol_if", "arbol_rl", "completo")}
    return out


def sensibilidad() -> dict:
    res = {}
    for nombre, df in _conjuntos().items():
        if nombre == "muestra_330":
            continue
        y = codificar_objetivo(df["resultado_esperado"])
        anom = df["anomalia"].values
        comp = _componentes(df)
        s = comp[1]
        fil_if = []
        for adv in (0.55, 0.60, 0.65, 0.70, 0.75, 0.80):
            for crit in (0.80, 0.85, 0.90, 0.95):
                if crit <= adv:
                    continue
                u = dict(UMBRALES_ACTUALES, adv=adv, crit=crit)
                m = metricas(decidir(*comp, u=u), y, anom)
                m.update(adv=adv, crit=crit,
                         recall_if=round(float((s[anom == 1] >= adv).mean()), 4),
                         falsas_alarmas_pct=round(float((s[anom == 0] >= adv).mean()), 4))
                fil_if.append(m)
        fil_lr = []
        for aut in (0.80, 0.85, 0.90, 0.95):
            for apr in (0.50, 0.55, 0.60, 0.65, 0.70):
                u = dict(UMBRALES_ACTUALES, aut=aut, apr=apr)
                m = metricas(decidir(*comp, u=u), y, anom)
                m.update(aut=aut, apr=apr)
                fil_lr.append(m)
        res[nombre] = {"isolation_forest": fil_if, "regresion_logistica": fil_lr}
    return res


def desglose_anomalias() -> dict:
    esc = pd.read_csv(DATA_DIR / "escenarios_evaluacion.csv")
    a = esc[esc.anomalia == 1].reset_index(drop=True)
    d_arb, s, legit = _componentes(a)
    final = decidir(d_arb, s, legit)
    nivel = np.where(s > 0.85, "CRITICO", np.where(s >= 0.70, "ADVERTENCIA", "NORMAL"))
    tab = pd.crosstab(pd.Series(nivel, name="nivel"), pd.Series([DECISIONES[i] for i in final], name="final"))
    arb = pd.crosstab(pd.Series(nivel, name="nivel"), pd.Series([DECISIONES[i] for i in d_arb], name="arbol"))
    return {"nivel_x_decision_final": tab.to_dict(), "nivel_x_decision_arbol": arb.to_dict(),
            "permiso_rechazado_por_arbol": int((d_arb == RECH).sum()),
            "detectadas_if": int((s >= 0.70).sum()), "bloqueo_final_no_autorizadas": int((final != AUT).sum()),
            "rechazadas_final": int((final == RECH).sum()), "derivadas_final": int((final == REQ).sum())}


def main():
    res = {"generacion": auditoria_generacion(), "muestra": muestra_experimental(), "ablacion": ablacion(),
           "sensibilidad": sensibilidad(), "anomalias_muestra": desglose_anomalias()}
    (REPORTS_DIR / "analisis_complementario.json").write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str),
                                                            encoding="utf-8")
    print(json.dumps({k: res[k] for k in ("generacion", "muestra", "ablacion", "anomalias_muestra")},
                     ensure_ascii=False, indent=1, default=str))


if __name__ == "__main__":
    main()
