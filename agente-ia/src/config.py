"""Configuración general del agente (rutas, umbrales e hiperparámetros del informe)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

try:  # carga variables desde agente-ia/.env si existe
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"
FIGURES_DIR = REPORTS_DIR / "figuras"

SEMILLA = 42
ZONA_HORARIA = "America/Lima"

# Base de datos de auditoría (SQLite en desarrollo; MySQL/PostgreSQL en integración)
#   SQLite:  sqlite:///agente_auditoria.db
#   MySQL:   mysql+pymysql://usuario:clave@localhost:3306/CitasMedicasSanGenaronew
DB_URL = os.getenv("AGENTE_DB_URL", f"sqlite:///{BASE_DIR / 'agente_auditoria.db'}")

# Umbrales de decisión (Tabla 9 del informe)
UMBRAL_ANOMALIA_CRITICO = 0.85
UMBRAL_ANOMALIA_ADVERTENCIA = 0.70
UMBRAL_LR_AUTORIZAR = 0.90
UMBRAL_LR_APROBACION = 0.60

# Hiperparámetros (Tabla 10 del informe)
HIPER_ARBOL = dict(max_depth=7, min_samples_split=10, min_samples_leaf=5, criterion="gini",
                   class_weight="balanced", random_state=SEMILLA)
HIPER_ISOLATION = dict(n_estimators=100, max_samples=256, contamination=0.1, random_state=SEMILLA)
HIPER_LOGISTICA = dict(penalty="l2", C=1.0, solver="lbfgs", max_iter=1000, class_weight="balanced")

# Ventana para calcular la frecuencia de accesos de un usuario (minutos)
VENTANA_FRECUENCIA_MIN = 60
