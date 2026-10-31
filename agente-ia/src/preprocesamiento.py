"""
Preprocesamiento del dataset (sección 3.5 del informe).

  - One-Hot Encoding de rol, tipo de documento y relación con el paciente.
  - Hora "HH:MM" -> número decimal y bandera fuera_horario.
  - Variables binarias en 0/1.
  - StandardScaler sobre la frecuencia (solo para la Regresión Logística).
  - Desviación de la frecuencia respecto del comportamiento habitual del rol (para Isolation Forest).

El identificador del evento NO se usa como predictor.
"""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from .reglas import ROLES, DOCUMENTOS, RELACIONES, DECISIONES, fuera_de_horario

COL_ROL = [f"rol_{r}" for r in ROLES]
COL_DOC = [f"doc_{d}" for d in DOCUMENTOS]
COL_REL = [f"rel_{r}" for r in RELACIONES]

# Atributos x1..x5 del Árbol de Decisión (sección 2.3): rol, relación (médico tratante),
# autorización especial, tipo de documento y horario.
FEATURES_ARBOL = COL_ROL + COL_REL + ["autorizacion_excepcional"] + COL_DOC + ["hora_num", "fuera_horario"]
# Regresión Logística: mismos atributos + frecuencia estandarizada
FEATURES_LOGISTICA = FEATURES_ARBOL + ["frecuencia_std"]
# Isolation Forest: comportamiento (frecuencia/velocidad, horario y desviación habitual)
# (las variables se eligieron con el conjunto de validación: horario, frecuencia o velocidad de
#  solicitudes por hora, desviación respecto de la frecuencia habitual del rol y el rol)
FEATURES_ISOLATION = ["hora_num", "frecuencia_accesos", "desviacion_rol"] + COL_ROL

NOMBRES_LEGIBLES = {
    "rol_medico": "rol médico", "rol_enfermeria": "rol enfermería",
    "rol_administrativo": "rol administrativo", "rol_administrador": "rol administrador",
    "rel_medico_tratante": "es médico tratante", "rel_personal_apoyo": "es personal de apoyo",
    "rel_sin_relacion": "sin relación con el paciente",
    "autorizacion_excepcional": "tiene autorización excepcional",
    "doc_historia_clinica": "documento historia clínica", "doc_resultado_laboratorio": "documento resultado de laboratorio",
    "doc_orden_medica": "documento orden médica",
    "hora_num": "hora de acceso", "fuera_horario": "fuera del horario laboral",
}


def hora_a_decimal(hora: str) -> float:
    h, m = str(hora).split(":")[:2]
    return int(h) + int(m) / 60


class Preprocesador:
    """Transforma eventos de acceso (dict o DataFrame) en matrices numéricas para cada modelo."""

    def __init__(self):
        self.scaler = StandardScaler()
        self.media_rol: dict = {}
        self.desv_rol: dict = {}

    # ----------------------------------------------------------------- base
    @staticmethod
    def _base(df: pd.DataFrame) -> pd.DataFrame:
        out = pd.DataFrame(index=df.index)
        for r in ROLES:
            out[f"rol_{r}"] = (df["rol_usuario"] == r).astype(int)
        for d in DOCUMENTOS:
            out[f"doc_{d}"] = (df["tipo_documento"] == d).astype(int)
        for r in RELACIONES:
            out[f"rel_{r}"] = (df["relacion_paciente"] == r).astype(int)
        out["autorizacion_excepcional"] = df["autorizacion_excepcional"].astype(int)
        out["hora_num"] = df["hora_acceso"].apply(hora_a_decimal).round(2)
        out["fuera_horario"] = out["hora_num"].apply(fuera_de_horario).astype(int)
        out["frecuencia_accesos"] = df["frecuencia_accesos"].astype(float)
        out["_rol"] = df["rol_usuario"].values
        return out

    # ----------------------------------------------------------------- fit / transform
    def fit(self, df: pd.DataFrame):
        b = self._base(df)
        self.scaler.fit(b[["frecuencia_accesos"]])
        g = b.groupby("_rol")["frecuencia_accesos"]
        self.media_rol = g.mean().to_dict()
        self.desv_rol = g.std().replace(0, 1).to_dict()
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        b = self._base(df)
        b["frecuencia_std"] = self.scaler.transform(b[["frecuencia_accesos"]]).ravel().round(3)
        b["desviacion_rol"] = [
            (f - self.media_rol.get(r, 0.0)) / self.desv_rol.get(r, 1.0)
            for f, r in zip(b["frecuencia_accesos"], b["_rol"])
        ]
        b["desviacion_rol"] = b["desviacion_rol"].round(3)
        return b.drop(columns=["_rol"])

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        return self.fit(df).transform(df)

    @staticmethod
    def evento_a_df(evento: dict) -> pd.DataFrame:
        return pd.DataFrame([evento])


def codificar_objetivo(serie: pd.Series) -> np.ndarray:
    """RECHAZAR=0, AUTORIZAR=1, REQUIERE_APROBACION=2 (misma codificación que la Tabla 8)."""
    return serie.map({d: i for i, d in enumerate(DECISIONES)}).values
