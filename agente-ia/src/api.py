"""
API del agente de IA (Tabla 11 del informe).

  POST /api/evaluaracceso   Procesa y evalúa una solicitud de acceso
  POST /api/interpretar     Interpreta una solicitud escrita en español (NLP)
  GET  /api/estadisticas    Estadísticas y reportes de auditoría
  GET  /api/auditoria       Últimos registros de auditoría
  GET  /api/alertas         Alertas de accesos anómalos
  PUT  /api/alertas/{id}/revisar  Marca una alerta como revisada
  GET  /health              Estado del sistema

Ejecutar:  uvicorn src.api:app --reload --port 8000
Documentación interactiva (Swagger): http://localhost:8000/docs
"""
import os
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .agente import AgenteAcceso
from .nlp import interpretar

app = FastAPI(
    title="Agente de IA - Control de acceso a documentos médicos",
    description="Centro de Salud Materno Infantil San Genaro de Villa. Árbol de Decisión + Isolation Forest + "
                "Regresión Logística.",
    version="1.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_agente: AgenteAcceso | None = None
API_KEY = os.getenv("AGENTE_API_KEY")  # opcional: clave compartida con el backend de CareNest


def agente() -> AgenteAcceso:
    global _agente
    if _agente is None:
        _agente = AgenteAcceso()
    return _agente


def verificar_clave(x_api_key: Optional[str] = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Clave de API inválida")


class SolicitudAcceso(BaseModel):
    usuario_id: int = Field(..., examples=[7])
    rol: str = Field(..., description="MEDICO, ENFERMERIA, ADMISION, ADMIN (o medico, enfermeria, administrativo, administrador)",
                     examples=["MEDICO"])
    tipo_documento: Literal["historia_clinica", "resultado_laboratorio", "orden_medica"]
    relacion_paciente: Literal["medico_tratante", "personal_apoyo", "sin_relacion"]
    autorizacion_excepcional: bool = False
    documento_id: Optional[int] = None
    paciente_id: Optional[int] = None
    hora_acceso: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="HH:MM; si se omite, la hora actual de Lima")
    frecuencia_accesos: Optional[int] = Field(None, ge=1, description="Si se omite, se calcula de la auditoría (última hora)")
    solicitud_texto: Optional[str] = None


class SolicitudTexto(BaseModel):
    mensaje: str = Field(..., examples=["Necesito la historia clínica del paciente Juan Perez porque soy su médico tratante"])


@app.get("/health")
def health():
    try:
        a = agente()
        return {"ok": True, "estado": "operativo", "modelos": ["arbol_decision", "isolation_forest", "regresion_logistica"],
                "base_auditoria": a.auditoria.engine.url.get_backend_name()}
    except Exception as e:  # modelos no entrenados o BD inaccesible
        return {"ok": False, "estado": "error", "detalle": str(e)}


@app.post("/api/evaluaracceso", dependencies=[Depends(verificar_clave)])
def evaluar_acceso(s: SolicitudAcceso):
    try:
        resultado = agente().procesar_solicitud(**s.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, **resultado}


@app.post("/api/interpretar", dependencies=[Depends(verificar_clave)])
def interpretar_solicitud(s: SolicitudTexto):
    return {"ok": True, **interpretar(s.mensaje)}


@app.get("/api/estadisticas", dependencies=[Depends(verificar_clave)])
def estadisticas():
    return {"ok": True, **agente().auditoria.estadisticas()}


@app.get("/api/auditoria", dependencies=[Depends(verificar_clave)])
def auditoria(limite: int = 50):
    return {"ok": True, "registros": agente().auditoria.ultimos(min(max(limite, 1), 500))}


@app.get("/api/alertas", dependencies=[Depends(verificar_clave)])
def alertas(limite: int = 50, solo_pendientes: bool = False):
    return {"ok": True, "alertas": agente().auditoria.alertas(min(max(limite, 1), 500), solo_pendientes)}


@app.put("/api/alertas/{id_alerta}/revisar", dependencies=[Depends(verificar_clave)])
def revisar_alerta(id_alerta: int):
    if not agente().auditoria.marcar_alerta_revisada(id_alerta):
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return {"ok": True, "id_alerta": id_alerta, "revisada": True}
