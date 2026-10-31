"""
Generación del dataset sintético de eventos de acceso (sección 3.5 del informe).

Cada fila representa un EVENTO DE ACCESO (unidad de análisis). No se usan datos reales:
no hay nombres, DNI ni diagnósticos. La decisión esperada se asigna ANTES de entrenar
con la matriz de roles y permisos (reglas.py), lo que evita el sesgo de verificación.

Salidas:
  data/dataset_entrenamiento.csv  -> eventos para entrenar/validar/probar los modelos
  data/escenarios_evaluacion.csv  -> escenarios de la Tabla 3 (independientes del entrenamiento)

Uso:  python -m src.generar_dataset
"""
import numpy as np
import pandas as pd

from .config import DATA_DIR, SEMILLA
from .reglas import decision_esperada, HORA_INICIO_LABORAL, HORA_FIN_LABORAL

PESO_ROL = {"medico": 0.35, "enfermeria": 0.30, "administrativo": 0.20, "administrador": 0.15}
PESO_RELACION = {
    "medico": {"medico_tratante": 0.50, "personal_apoyo": 0.25, "sin_relacion": 0.25},
    "enfermeria": {"personal_apoyo": 0.70, "sin_relacion": 0.30},
    "administrativo": {"personal_apoyo": 0.40, "sin_relacion": 0.60},
    "administrador": {"personal_apoyo": 0.30, "sin_relacion": 0.70},
}
PESO_DOCUMENTO = {"historia_clinica": 0.45, "resultado_laboratorio": 0.35, "orden_medica": 0.20}
# Solicitudes por hora (incluida la actual) en un comportamiento normal: de 1 hasta el máximo habitual del rol
MAX_FRECUENCIA_NORMAL = {"medico": 18, "enfermeria": 22, "administrativo": 10, "administrador": 8}
PROB_GUARDIA_NOCTURNA = {"medico": 0.10, "enfermeria": 0.25, "administrativo": 0.0, "administrador": 0.0}


def _elegir(rng, pesos: dict) -> str:
    claves = list(pesos)
    return rng.choice(claves, p=np.array(list(pesos.values())) / sum(pesos.values()))


def _hora_normal(rng, rol: str) -> float:
    if rng.random() < PROB_GUARDIA_NOCTURNA[rol]:
        # turno de guardia: 20:00 a 06:59
        h = rng.uniform(HORA_FIN_LABORAL, 24 + HORA_INICIO_LABORAL) % 24
    else:
        h = rng.uniform(HORA_INICIO_LABORAL, HORA_FIN_LABORAL - 0.01)
    return round(h * 60) / 60  # minutos exactos


def _evento_normal(rng) -> dict:
    rol = _elegir(rng, PESO_ROL)
    relacion = _elegir(rng, PESO_RELACION[rol])
    documento = _elegir(rng, PESO_DOCUMENTO)
    p_exc = 0.20 if relacion == "sin_relacion" else 0.08
    return {
        "rol_usuario": rol,
        "tipo_documento": documento,
        "relacion_paciente": relacion,
        "hora": _hora_normal(rng, rol),
        "autorizacion_excepcional": int(rng.random() < p_exc),
        "frecuencia_accesos": int(rng.integers(1, MAX_FRECUENCIA_NORMAL[rol] + 1)),
        "anomalia": 0,
    }


def _evento_anomalo(rng) -> dict:
    """Tres patrones de acceso anómalo descritos en el informe."""
    e = _evento_normal(rng)
    tipo = rng.choice(["masivo", "madrugada", "curioseo"], p=[0.40, 0.30, 0.30])
    if tipo == "masivo":                      # muchas consultas en poco tiempo
        e["frecuencia_accesos"] = int(rng.integers(35, 91))
    elif tipo == "madrugada":                 # acceso a horas atípicas sin turno de guardia
        e["rol_usuario"] = rng.choice(["administrativo", "administrador", "medico"], p=[0.4, 0.3, 0.3])
        e["relacion_paciente"] = "sin_relacion" if e["rol_usuario"] != "administrativo" or rng.random() < 0.7 else "personal_apoyo"
        e["hora"] = round(rng.uniform(0.0, 5.5) * 60) / 60
        e["frecuencia_accesos"] = int(rng.integers(12, 30))
    else:                                     # consulta repetida de historias sin relación
        e["relacion_paciente"] = "sin_relacion"
        if e["rol_usuario"] == "medico" and rng.random() < 0.5:
            e["rol_usuario"] = "enfermeria"
        e["tipo_documento"] = "historia_clinica"
        e["frecuencia_accesos"] = int(rng.integers(26, 46))
    e["anomalia"] = 1
    return e


def _completar(df: pd.DataFrame, prefijo: str, ruido_registro: float = 0.0, rng=None) -> pd.DataFrame:
    """Asigna la decisión esperada con la matriz de roles.

    ruido_registro simula errores de registro reales: en esa proporción de eventos la relación
    con el paciente que queda registrada en el sistema no coincide con la relación real que usó
    el responsable para decidir (p. ej., interconsultas o reasignaciones no actualizadas).
    """
    df = df.copy()
    df["resultado_esperado"] = [
        decision_esperada(r.rol_usuario, r.tipo_documento, r.relacion_paciente, r.hora, r.autorizacion_excepcional)
        for r in df.itertuples()
    ]
    if ruido_registro > 0:
        afectados = rng.random(len(df)) < ruido_registro
        for i in np.where(afectados)[0]:
            actual = df.iloc[i]["relacion_paciente"]
            opciones = [r for r in ("medico_tratante", "personal_apoyo", "sin_relacion")
                        if r != actual and (r != "medico_tratante" or df.iloc[i]["rol_usuario"] == "medico")]
            df.iloc[i, df.columns.get_loc("relacion_paciente")] = rng.choice(opciones)
    df["hora_acceso"] = df["hora"].apply(lambda h: f"{int(h) % 24:02d}:{int(round((h % 1) * 60)) % 60:02d}")
    df.insert(0, "id_evento", [f"{prefijo}{i:05d}" for i in range(1, len(df) + 1)])
    columnas = ["id_evento", "rol_usuario", "tipo_documento", "relacion_paciente", "hora_acceso",
                "autorizacion_excepcional", "frecuencia_accesos", "resultado_esperado", "anomalia"]
    return df[columnas]


def generar_entrenamiento(n: int = 8000, tasa_anomalia: float = 0.10, ruido_registro: float = 0.03,
                          semilla: int = SEMILLA) -> pd.DataFrame:
    rng = np.random.default_rng(semilla)
    filas = [_evento_anomalo(rng) if rng.random() < tasa_anomalia else _evento_normal(rng) for _ in range(n)]
    return _completar(pd.DataFrame(filas), "E", ruido_registro, rng)


CLAVE = ["rol_usuario", "tipo_documento", "relacion_paciente", "hora", "autorizacion_excepcional", "frecuencia_accesos"]


def _clave_evento(e: dict) -> tuple:
    return tuple(str(round(e[c], 4)) if c == "hora" else str(e[c]) for c in CLAVE)


def generar_escenarios(vistos: set, semilla: int = SEMILLA + 1000) -> pd.DataFrame:
    """Escenarios de la Tabla 3: 100 legítimos, 100 no autorizados, 20 de roles, 10 excepcionales y 100 anómalos.

    `vistos` contiene las claves de los eventos de entrenamiento: ningún escenario puede repetir uno
    de ellos, lo que evita la fuga de información entre entrenamiento y evaluación.
    """
    rng = np.random.default_rng(semilla)
    filas = []

    def agregar(evento, grupo):
        k = _clave_evento(evento)
        if k in vistos:
            return False
        vistos.add(k)
        evento["grupo"] = grupo
        filas.append(evento)
        return True

    # 1) 100 solicitudes legítimas (decisión esperada AUTORIZAR, comportamiento normal)
    while sum(f["grupo"] == "legitima" for f in filas) < 100:
        e = _evento_normal(rng)
        if decision_esperada(e["rol_usuario"], e["tipo_documento"], e["relacion_paciente"], e["hora"], e["autorizacion_excepcional"]) == "AUTORIZAR":
            agregar(e, "legitima")
    # 2) 100 intentos no autorizados (decisión esperada RECHAZAR, comportamiento normal)
    while sum(f["grupo"] == "no_autorizada" for f in filas) < 100:
        e = _evento_normal(rng)
        if decision_esperada(e["rol_usuario"], e["tipo_documento"], e["relacion_paciente"], e["hora"], e["autorizacion_excepcional"]) == "RECHAZAR":
            agregar(e, "no_autorizada")
    # 3) 20 escenarios de control de roles (5 por rol, decisiones mixtas)
    for rol in ["medico", "enfermeria", "administrativo", "administrador"]:
        k = 0
        while k < 5:
            e = _evento_normal(rng)
            if e["rol_usuario"] == rol and agregar(e, f"rol_{rol}"):
                k += 1
    # 4) 10 casos excepcionales: acceso temporal con autorización aprobada (médico ausente)
    k = 0
    while k < 10:
        e = _evento_normal(rng)
        if e["rol_usuario"] in ("medico", "enfermeria") and e["relacion_paciente"] == "sin_relacion":
            e["autorizacion_excepcional"] = 1
            e["hora"] = round(rng.uniform(8, 18) * 60) / 60
            if agregar(e, "excepcional"):
                k += 1
    # 5) 100 eventos con anomalías implantadas
    while sum(f["grupo"] == "anomalia" for f in filas) < 100:
        agregar(_evento_anomalo(rng), "anomalia")

    df = pd.DataFrame(filas)
    grupos = df.pop("grupo")
    out = _completar(df, "T")
    out.insert(1, "grupo", grupos.values)
    return out


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    entrenamiento = generar_entrenamiento()
    entrenamiento = entrenamiento.drop_duplicates(subset=entrenamiento.columns[1:]).reset_index(drop=True)
    vistos = {
        (r.rol_usuario, r.tipo_documento, r.relacion_paciente,
         str(round(int(r.hora_acceso[:2]) + int(r.hora_acceso[3:5]) / 60, 4)),
         str(r.autorizacion_excepcional), str(r.frecuencia_accesos))
        for r in entrenamiento.itertuples()
    }
    escenarios = generar_escenarios(vistos)
    entrenamiento.to_csv(DATA_DIR / "dataset_entrenamiento.csv", index=False)
    escenarios.to_csv(DATA_DIR / "escenarios_evaluacion.csv", index=False)
    print(f"Dataset de entrenamiento: {len(entrenamiento)} eventos")
    print(entrenamiento["resultado_esperado"].value_counts().to_string())
    print(f"Anomalías: {entrenamiento['anomalia'].sum()} ({entrenamiento['anomalia'].mean():.1%})")
    print(f"\nEscenarios de evaluación: {len(escenarios)}")
    print(escenarios["grupo"].value_counts().to_string())


if __name__ == "__main__":
    main()
