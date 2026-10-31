# CareNest + Agente de IA para el control de acceso a documentos médicos

Sistema del **Centro de Salud Materno Infantil San Genaro de Villa** (Chorrillos, Lima) que integra
un agente de IA basado en **clasificación de permisos y detección de accesos anómalos**.
Proyecto del curso Sistemas Inteligentes y Machine Learning – Universidad Privada del Norte.

## Arquitectura

```
Frontend (React + Vite)  ──►  Backend CareNest (Node + Express + TypeORM)  ──►  MySQL
        :5173                         :3000                                       ▲
                                        │  POST /api/evaluaracceso               │ auditoría
                                        ▼                                        │
                              Agente de IA (Python + FastAPI + scikit-learn) ────┘
                                      :8000
                   Árbol de Decisión → Isolation Forest → Regresión Logística
```

1. El personal pide un documento (chat en español o botón "Solicitar acceso").
2. El backend calcula el contexto: relación con el paciente (médico tratante, personal de apoyo o
   sin relación) y si existe una autorización excepcional vigente.
3. El agente decide **Autorizar / Rechazar / Requiere aprobación**, explica su decisión y la registra
   en la auditoría inmutable.
4. El contenido clínico solo se entrega si la decisión es Autorizar. Si el agente no responde,
   el acceso se deniega por seguridad.

## Puesta en marcha

### 1. Base de datos (MySQL 8)
Ejecutar en orden, en MySQL Workbench:
1. `base-de-datos/BDActualizado.sql` (base original de CareNest)
2. `base-de-datos/BD_agente_ia.sql` (rol ENFERMERIA, documentos, auditoría y datos de prueba)
3. `base-de-datos/BD_muestra_pruebas.sql` (muestra de 330 escenarios de prueba y dataset de 7 941 eventos)

### 2. Agente de IA
```bash
cd agente-ia
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env        # y completar AGENTE_DB_URL con tu usuario y clave de MySQL
uvicorn src.api:app --reload --port 8000
```
Los modelos ya vienen entrenados en `agente-ia/models`. Para reentrenar:
`python -m src.generar_dataset`, `python -m src.entrenar` y `python -m src.evaluar`.

**Pruebas con la muestra guardada en MySQL** (con `AGENTE_DB_URL` apuntando a MySQL en `agente-ia/.env`):
```bash
python -m src.evaluar --bd
```
Lee los 330 escenarios de la tabla `muestra_escenarios`, registra cada decisión en `access_logs`
(aparecen en el panel de auditoría) y guarda los resultados en `resultados_prueba`. Al final de
`BD_muestra_pruebas.sql` hay consultas SQL para verificar los resultados por grupo.
Si se regenera el dataset, `python -m src.exportar_muestra_sql` vuelve a crear ese script.

### 3. Backend
```bash
cd Backend
npm install
# opcional en Backend/.env: AGENTE_IA_URL=http://localhost:8000 (es el valor por defecto)
npm run dev
```

### 4. Frontend
```bash
cd Frontend
npm install
npm run dev
```

## Usuarios de prueba (contraseña: `admin123`)

| Correo | Rol | Qué probar |
|---|---|---|
| carlos.lopez@carenest.pe | MEDICO | Tratante de Juan Perez y Ana Flores: acceso autorizado. Sin relación con Maria Quispe: rechazado |
| maria.gonzales@carenest.pe | MEDICO | Atendió a Maria Quispe: laboratorio autorizado, historia requiere aprobación |
| elena.torres@carenest.pe | ENFERMERIA | Pacientes en triaje hoy: laboratorio autorizado, historia requiere aprobación |
| admision@carenest.pe | ADMISION | La información clínica se rechaza (entrar a `/personal/documentos`) |
| admin@carenest.pe | ADMIN | Panel de auditoría, alertas y aprobación de autorizaciones excepcionales |

## Pantallas

| Ruta | Rol | Función |
|---|---|---|
| `/personal/documentos` | MEDICO, ENFERMERIA, ADMISION, ADMIN | Chat con el agente, listado de documentos y solicitudes excepcionales |
| `/admin/auditoria` | ADMIN | Indicadores, alertas de Isolation Forest, aprobaciones y registros de auditoría |

Las capturas de ejecución están en `capturas/` y los resultados del modelo en
`agente-ia/README.md` y `agente-ia/reports/`.

## Importante antes de subir a GitHub
El archivo `Backend/.env` contiene contraseñas y **no debe subirse**; ya está excluido en `.gitignore`.
