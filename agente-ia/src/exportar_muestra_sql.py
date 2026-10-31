"""
Genera el script SQL que carga en MySQL la muestra de prueba y el dataset sintético.

  muestra_escenarios  -> 330 escenarios de la Tabla 3 (muestra de validación)
  dataset_eventos     -> 7 941 eventos usados para entrenar, validar y probar los modelos
  resultados_prueba   -> se llena al ejecutar  python -m src.evaluar --bd

Uso:  python -m src.exportar_muestra_sql   (escribe ../base-de-datos/BD_muestra_pruebas.sql o la ruta indicada)
"""
import sys
from pathlib import Path

import pandas as pd

from .config import BASE_DIR, DATA_DIR

CABECERA = """-- =================================================================
-- MUESTRA DE PRUEBAS Y DATASET DEL AGENTE DE IA
-- Ejecutar DESPUÉS de BDActualizado.sql y BD_agente_ia.sql.
-- Generado automáticamente por agente-ia/src/exportar_muestra_sql.py
-- a partir de agente-ia/data/*.csv (datos sintéticos, sin datos personales).
-- =================================================================
USE CitasMedicasSanGenaronew;
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `resultados_prueba`;
DROP TABLE IF EXISTS `muestra_escenarios`;
DROP TABLE IF EXISTS `dataset_eventos`;

-- Muestra de validación (Tabla 3 del informe): muestreo no probabilístico intencional
CREATE TABLE `muestra_escenarios` (
  `id_evento`                 varchar(10) NOT NULL,
  `grupo`                     varchar(30) NOT NULL,   -- legitima, no_autorizada, rol_*, excepcional, anomalia
  `rol_usuario`               enum('medico','enfermeria','administrativo','administrador') NOT NULL,
  `tipo_documento`            enum('historia_clinica','resultado_laboratorio','orden_medica') NOT NULL,
  `relacion_paciente`         enum('medico_tratante','personal_apoyo','sin_relacion') NOT NULL,
  `hora_acceso`               char(5) NOT NULL,
  `autorizacion_excepcional`  tinyint(1) NOT NULL,
  `frecuencia_accesos`        int NOT NULL,
  `resultado_esperado`        enum('AUTORIZAR','RECHAZAR','REQUIERE_APROBACION') NOT NULL,
  `anomalia`                  tinyint(1) NOT NULL,
  PRIMARY KEY (`id_evento`),
  KEY `idx_muestra_grupo` (`grupo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dataset sintético de entrenamiento (sección 3.5 del informe)
CREATE TABLE `dataset_eventos` (
  `id_evento`                 varchar(10) NOT NULL,
  `rol_usuario`               enum('medico','enfermeria','administrativo','administrador') NOT NULL,
  `tipo_documento`            enum('historia_clinica','resultado_laboratorio','orden_medica') NOT NULL,
  `relacion_paciente`         enum('medico_tratante','personal_apoyo','sin_relacion') NOT NULL,
  `hora_acceso`               char(5) NOT NULL,
  `autorizacion_excepcional`  tinyint(1) NOT NULL,
  `frecuencia_accesos`        int NOT NULL,
  `resultado_esperado`        enum('AUTORIZAR','RECHAZAR','REQUIERE_APROBACION') NOT NULL,
  `anomalia`                  tinyint(1) NOT NULL,
  PRIMARY KEY (`id_evento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Decisiones del agente sobre la muestra (una fila por escenario y ejecución)
CREATE TABLE `resultados_prueba` (
  `id_resultado`      int NOT NULL AUTO_INCREMENT,
  `ejecucion`         varchar(20) NOT NULL,
  `id_evento`         varchar(10) NOT NULL,
  `id_log`            int DEFAULT NULL,           -- registro de auditoría en access_logs
  `decision_agente`   enum('AUTORIZAR','RECHAZAR','REQUIERE_APROBACION') NOT NULL,
  `decision_arbol`    enum('AUTORIZAR','RECHAZAR','REQUIERE_APROBACION') NOT NULL,
  `score_anomalia`    float NOT NULL,
  `nivel_alerta`      varchar(15) NOT NULL,
  `prob_legitimidad`  float DEFAULT NULL,
  `tiempo_ms`         float NOT NULL,
  `correcto`          tinyint(1) NOT NULL,
  `fecha`             timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_resultado`),
  KEY `idx_resultado_evento` (`id_evento`),
  CONSTRAINT `resultados_prueba_ibfk_evento` FOREIGN KEY (`id_evento`) REFERENCES `muestra_escenarios` (`id_evento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
"""

PIE = """
-- =================================================================
-- CONSULTAS DE VERIFICACIÓN (después de ejecutar: python -m src.evaluar --bd)
-- =================================================================
-- Composición de la muestra:
--   SELECT grupo, COUNT(*) FROM muestra_escenarios GROUP BY grupo;
-- Resultado por grupo en la última ejecución
-- (en el grupo "anomalia" la métrica que importa es la columna alertas, no pct_correcto: el agente
--  bloquea o deriva esas solicitudes aunque la matriz de permisos las autorizaría):
--   SELECT m.grupo, COUNT(*) AS n, ROUND(100*AVG(r.correcto),1) AS pct_correcto,
--          SUM(r.nivel_alerta <> 'NORMAL') AS alertas
--   FROM resultados_prueba r JOIN muestra_escenarios m USING (id_evento)
--   WHERE r.ejecucion = (SELECT MAX(ejecucion) FROM resultados_prueba)
--   GROUP BY m.grupo;
-- Detección de anomalías (recall):
--   SELECT ROUND(100*AVG(r.nivel_alerta <> 'NORMAL'),1) AS recall_anomalias
--   FROM resultados_prueba r JOIN muestra_escenarios m USING (id_evento)
--   WHERE m.anomalia = 1 AND r.ejecucion = (SELECT MAX(ejecucion) FROM resultados_prueba);
"""

COLS_MUESTRA = ["id_evento", "grupo", "rol_usuario", "tipo_documento", "relacion_paciente", "hora_acceso",
                "autorizacion_excepcional", "frecuencia_accesos", "resultado_esperado", "anomalia"]
COLS_DATASET = [c for c in COLS_MUESTRA if c != "grupo"]


def _valor(v) -> str:
    if isinstance(v, str):
        return "'" + v.replace("'", "''") + "'"
    return str(int(v))


def _inserts(tabla: str, df: pd.DataFrame, cols: list[str], lote: int = 500) -> str:
    partes = []
    for i in range(0, len(df), lote):
        filas = ",\n".join("(" + ", ".join(_valor(v) for v in fila) + ")"
                           for fila in df.iloc[i:i + lote][cols].itertuples(index=False))
        partes.append(f"INSERT INTO `{tabla}` ({', '.join(cols)}) VALUES\n{filas};\n")
    return "\n".join(partes)


def main(salida: Path | None = None):
    salida = salida or (BASE_DIR.parent / "base-de-datos" / "BD_muestra_pruebas.sql")
    salida.parent.mkdir(parents=True, exist_ok=True)
    muestra = pd.read_csv(DATA_DIR / "escenarios_evaluacion.csv", dtype={"hora_acceso": str})
    dataset = pd.read_csv(DATA_DIR / "dataset_entrenamiento.csv", dtype={"hora_acceso": str})
    sql = (CABECERA + "\n-- ---------- Muestra de validación ----------\n" + _inserts("muestra_escenarios", muestra, COLS_MUESTRA)
           + "\n-- ---------- Dataset de entrenamiento ----------\n" + _inserts("dataset_eventos", dataset, COLS_DATASET) + PIE)
    salida.write_text(sql, encoding="utf-8")
    print(f"{salida}: {len(muestra)} escenarios y {len(dataset)} eventos")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else None)
