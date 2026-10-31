"""
Puntaje de anomalía normalizado entre 0 y 1 a partir de Isolation Forest.

Isolation Forest calcula s(x, n) = 2^(-E[h(x)] / c(n))  (ecuación 4 del informe).
En scikit-learn, s(x, n) = -score_samples(x), y el umbral que separa normales de anómalos
según contamination=0,1 es -offset_.

Para usar los umbrales del informe (0,70 advertencia y 0,85 crítico), s se normaliza con una
función lineal por tramos: el umbral propio del modelo se hace coincidir con 0,70, el mínimo
observado en entrenamiento con 0 y el máximo observado con 1.
"""
import numpy as np

from .config import UMBRAL_ANOMALIA_ADVERTENCIA


class NormalizadorAnomalia:
    def __init__(self):
        self.s_min = 0.0
        self.s_umbral = 0.5
        self.s_max = 1.0

    def fit(self, isolation_forest, X_entrenamiento):
        s = -isolation_forest.score_samples(X_entrenamiento)
        self.s_min = float(np.percentile(s, 0.5))
        self.s_max = float(np.percentile(s, 99.5))
        self.s_umbral = float(-isolation_forest.offset_)
        return self

    def puntaje_crudo(self, isolation_forest, X) -> np.ndarray:
        return -isolation_forest.score_samples(X)

    def transform(self, s: np.ndarray) -> np.ndarray:
        s = np.asarray(s, dtype=float)
        a = UMBRAL_ANOMALIA_ADVERTENCIA
        bajo = a * (s - self.s_min) / max(self.s_umbral - self.s_min, 1e-9)
        alto = a + (1 - a) * (s - self.s_umbral) / max(self.s_max - self.s_umbral, 1e-9)
        return np.clip(np.where(s <= self.s_umbral, bajo, alto), 0.0, 1.0)

    def puntaje(self, isolation_forest, X) -> np.ndarray:
        return self.transform(self.puntaje_crudo(isolation_forest, X))
