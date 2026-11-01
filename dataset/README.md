# Dataset de eventos de acceso a documentos médicos (sintético)

Dataset utilizado en el artículo **«Sistema inteligente de gestión y control de acceso a documentos médicos mediante un agente de IA basado en clasificación de permisos y detección de accesos anómalos»** (Universidad Privada del Norte, curso Sistemas Inteligentes y Machine Learning, 2026-2).

> **Naturaleza de los datos:** el dataset es **sintético**. Fue generado con Python a partir de la matriz de roles y permisos del Centro de Salud Materno Infantil San Genaro de Villa (Chorrillos, Lima). **No contiene datos personales reales** (nombres, DNI, diagnósticos ni historias clínicas), porque la Ley N.° 29733 de Protección de Datos Personales restringe el uso de información de salud. Cada fila representa un *evento de acceso*: una solicitud de un miembro del personal para consultar un documento médico.

## Archivos

| Archivo | Filas | Contenido |
|---|---|---|
| `eventos_acceso_sinteticos.csv` | 7 941 | Dataset original con la partición usada en el experimento (columna `particion`) |
| `eventos_acceso_procesados.csv` | 7 941 | Mismos eventos después del preprocesamiento (One-Hot Encoding, hora decimal, StandardScaler, atributos derivados) |
| `muestra_validacion_330.csv` | 330 | Muestra intencional de validación del agente (Tabla 3 del informe) |
| `diccionario_datos.csv` | 11 | Descripción de cada variable |

## Distribución

**Clases (`resultado_esperado`):** 2 585 AUTORIZAR · 2 637 RECHAZAR · 2 719 REQUIERE_APROBACION

**Anomalías implantadas (`anomalia = 1`):** 794 eventos (10 %): consultas masivas, accesos de madrugada sin turno y consulta repetida de historias de pacientes sin relación.

**Errores de registro:** en el 3 % de los eventos la relación registrada con el paciente difiere de la real (simula interconsultas o reasignaciones no actualizadas), para no obtener un escenario artificialmente perfecto.

| Partición | Eventos | AUTORIZAR | RECHAZAR | REQUIERE_APROBACION |
|---|---|---|---|---|
| entrenamiento | 5 558 | 1 809 | 1 846 | 1 903 |
| validacion | 1 191 | 388 | 395 | 408 |
| prueba | 1 192 | 388 | 396 | 408 |

**Roles:** médico 2 700 · enfermería 2 350 · administrativo 1 651 · administrador 1 240
**Documentos:** historia clínica 3 646 · resultado de laboratorio 2 768 · orden médica 1 527
**Relación con el paciente:** sin relación 3 450 · personal de apoyo 3 215 · médico tratante 1 276

**Muestra de validación (330):** 100 legítimas · 100 no autorizadas · 20 de control de roles (5 por rol) · 10 excepcionales · 100 con anomalías.

## Cómo se generó

- Script: [`agente-ia/src/generar_dataset.py`](../agente-ia/src/generar_dataset.py) (semilla aleatoria 42).
- Etiqueta: [`agente-ia/src/reglas.py`](../agente-ia/src/reglas.py) aplica la matriz de roles y permisos a cada evento **antes** de entrenar los modelos.
- Preprocesamiento y partición: [`agente-ia/src/preprocesamiento.py`](../agente-ia/src/preprocesamiento.py) y [`agente-ia/src/entrenar.py`](../agente-ia/src/entrenar.py).
- Los mismos datos se cargan en MySQL con [`base-de-datos/BD_muestra_pruebas.sql`](../base-de-datos/BD_muestra_pruebas.sql) (tablas `dataset_eventos` y `muestra_escenarios`).

Para regenerarlo:
```bash
cd agente-ia
python -m src.generar_dataset
python -m src.entrenar
```

## Resultados obtenidos con este dataset

| Modelo (conjunto de prueba) | Resultado |
|---|---|
| Árbol de Decisión | Exactitud 97,65 % · F1 97,65 % |
| Regresión Logística | Exactitud 97,65 % · ROC-AUC 0,992 |
| Isolation Forest | Recall 90,6 % · Falsos positivos 0,84 % · ROC-AUC 0,995 |
| Agente completo (330 escenarios) | 7 de 8 criterios de éxito cumplidos |

## Autores y licencia

Mendoza Romero, J. L.; Bellido Monteagudo, A. E.; Niquen Surita, B. A.; Ogosi Auqui, J. A. (2026). Universidad Privada del Norte.

Licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es): se puede reutilizar citando la fuente.
