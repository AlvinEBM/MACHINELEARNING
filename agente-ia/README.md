# Agente de IA – Control de acceso a documentos médicos

Microservicio en **Python + FastAPI + scikit-learn** que decide si un miembro del personal del
Centro de Salud Materno Infantil San Genaro de Villa puede acceder a un documento médico.
Es la implementación de la solución IA/ML descrita en el informe (secciones 2.3, 3.4, 3.5 y 3.6).

```
Solicitud ──► NLP (español) ──► Fase 1: Árbol de Decisión      (¿tiene permiso?)
                               └► Fase 2: Isolation Forest      (¿comportamiento anómalo?)
                               └► Fase 3: Regresión Logística   (casos ambiguos)
                               └► Auditoría inmutable (access_logs / anomaly_alerts)
```

## Estructura

| Carpeta / archivo | Contenido |
|---|---|
| `src/reglas.py` | Matriz de roles y permisos (etiqueta esperada de cada evento) |
| `src/generar_dataset.py` | Dataset sintético de eventos de acceso y escenarios de la Tabla 3 |
| `src/preprocesamiento.py` | One-Hot Encoding, hora decimal, StandardScaler, desviación por rol |
| `src/entrenar.py` | Entrenamiento 70/15/15 de los tres modelos, métricas y figuras |
| `src/anomalia.py` | Puntaje de anomalía normalizado entre 0 y 1 |
| `src/agente.py` | Clase `AgenteAcceso` con `procesar_solicitud()` (Algoritmo 1) |
| `src/nlp.py` | Interpretación de solicitudes en español (NLTK Snowball + diccionario médico) |
| `src/auditoria.py` | Registro de auditoría con SQLAlchemy (`AccessLog`, `AnomalyAlert`) |
| `src/api.py` | API FastAPI |
| `src/evaluar.py` | Evaluación del agente completo con los criterios de éxito |
| `notebooks/entrenamiento_y_evaluacion.ipynb` | Notebook ejecutado con todo el proceso y sus salidas |
| `models/` | Modelos entrenados (pickle) |
| `reports/` | Métricas (`metricas_modelos.json`, `evaluacion_escenarios.json`) y figuras |
| `tests/` | Pruebas con pytest |

## Instalación y ejecución

```bash
cd agente-ia
python -m venv venv
venv\Scripts\activate            # Windows   (Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt

python -m src.generar_dataset    # 1. genera el dataset sintético
python -m src.entrenar           # 2. entrena y guarda los modelos
python -m src.evaluar            # 3. evalúa los criterios de éxito (o --bd para leer la muestra desde MySQL)
python -m src.analisis_resultados  # validación cruzada, análisis de errores y líneas base
python -m src.analisis_complementario  # generación del dataset, ablación, sensibilidad de umbrales y flujo de anomalías
python -m src.evaluar_nlp_ampliado    # 60 frases de mayor dificultad para el lenguaje natural
# prueba de carga (con la API en ejecución: uvicorn src.api:app --port 8000 --workers 1)
python -m src.prueba_carga --niveles 1 5 10 20 50 --solicitudes 300 --etiqueta "1 worker"
python -m pytest -q              # 4. pruebas

uvicorn src.api:app --reload --port 8000   # 5. levanta la API
```

Documentación interactiva (Swagger): <http://localhost:8000/docs>

Si al iniciar aparece un error al cargar los modelos (por otra versión de scikit-learn),
basta con ejecutar de nuevo `python -m src.entrenar`.

### Base de auditoría

Por defecto se usa SQLite (`agente_auditoria.db`). Para registrar la auditoría en la misma base
MySQL de CareNest, copia `.env.example` como `.env` y define:

```
AGENTE_DB_URL=mysql+pymysql://root:tu_clave@localhost:3306/MachineCitasMedicasSanGenaro
```

Las tablas `access_logs` y `anomaly_alerts` se crean con `BD_agente_ia.sql`, que además impide
modificar o borrar los registros de auditoría mediante triggers.

## Endpoints

| Endpoint | Método | Función |
|---|---|---|
| `/api/evaluaracceso` | POST | Procesa y evalúa una solicitud de acceso |
| `/api/interpretar` | POST | Interpreta una solicitud escrita en español |
| `/api/estadisticas` | GET | Estadísticas de la auditoría |
| `/api/auditoria` | GET | Últimos registros de auditoría |
| `/api/alertas` | GET | Alertas de accesos anómalos |
| `/api/alertas/{id}/revisar` | PUT | Marca una alerta como revisada |
| `/health` | GET | Estado del sistema |

Ejemplo:

```bash
curl -X POST http://localhost:8000/api/evaluaracceso -H "Content-Type: application/json" \
  -d '{"usuario_id":4,"rol":"MEDICO","tipo_documento":"historia_clinica","relacion_paciente":"medico_tratante"}'
```

## Resultados obtenidos

**Dataset:** 7 941 eventos sintéticos (2 585 Autorizar, 2 637 Rechazar, 2 719 Requiere aprobación;
10 % con anomalías implantadas). Partición estratificada 5 558 / 1 191 / 1 192. Para simular
errores reales de registro, el 3 % de los eventos tiene la relación con el paciente mal registrada.

| Modelo (conjunto de prueba) | Exactitud | Precisión | Recall | F1 |
|---|---|---|---|---|
| Árbol de Decisión (profundidad 7, 32 hojas) | 97,65 % | 97,69 % | 97,65 % | 97,65 % |
| Regresión Logística (ROC-AUC 0,992) | 97,65 % | 97,69 % | 97,65 % | 97,65 % |

| Isolation Forest (conjunto de prueba) | Valor |
|---|---|
| Recall de detección | 90,6 % |
| Precisión | 92,2 % |
| Tasa de falsos positivos | 0,8 % |
| ROC-AUC | 0,995 |

**Evaluación del agente completo (330 escenarios de la Tabla 3):**

| Criterio | Meta | Resultado | ¿Cumple? |
|---|---|---|---|
| Autorización correcta de accesos legítimos | ≥ 95 % | 100 % | Sí |
| Rechazo de accesos no autorizados | ≥ 95 % | 100 % | Sí |
| Detección de accesos anómalos | ≥ 90 % | 87 % | No |
| Control de roles diferenciados | 100 % | 100 % | Sí |
| Manejo de casos excepcionales | 100 % | 100 % | Sí |
| Tiempo de respuesta | < 500 ms | máx. 19,0 ms (prom. 11,0 ms, ejecución con MySQL) | Sí |
| Completitud de la auditoría | 100 % | 100 % | Sí |
| Interpretación del lenguaje natural | ≥ 90 % | 100 % (40 frases) | Sí |

De las 13 anomalías no detectadas, 11 fueron rechazadas igualmente por el Árbol de Decisión;
solo 1 de las 100 anomalías terminó autorizada.

> Limitación: los escenarios de evaluación no contienen ruido de registro, por eso el agente obtiene
> 100 % en ellos; el 97,65 % del conjunto de prueba es la estimación más realista. Las 40 frases de
> NLP fueron redactadas por el equipo y deberían ampliarse con frases reales del personal.
