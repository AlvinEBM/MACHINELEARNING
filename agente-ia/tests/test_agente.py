"""Pruebas unitarias del agente (pytest)."""
import pytest

from src.agente import AgenteAcceso
from src.auditoria import Auditoria
from src.nlp import interpretar
from src.reglas import decision_esperada


@pytest.fixture(scope="module")
def agente():
    return AgenteAcceso(Auditoria("sqlite:///:memory:"))


def test_matriz_medico_tratante():
    assert decision_esperada("medico", "historia_clinica", "medico_tratante", 10.5, 0) == "AUTORIZAR"


def test_matriz_administrativo_sin_autorizacion():
    assert decision_esperada("administrativo", "historia_clinica", "sin_relacion", 10.5, 0) == "RECHAZAR"


def test_matriz_enfermeria_historia_requiere_aprobacion():
    assert decision_esperada("enfermeria", "historia_clinica", "personal_apoyo", 10.5, 0) == "REQUIERE_APROBACION"


def test_agente_autoriza_medico_tratante(agente):
    r = agente.procesar_solicitud(1, "MEDICO", "historia_clinica", "medico_tratante", "10:30", False, 5)
    assert r["decision"] == "AUTORIZAR"
    assert "médico tratante" in r["explicacion"]


def test_agente_rechaza_administrativo(agente):
    r = agente.procesar_solicitud(2, "ADMISION", "historia_clinica", "sin_relacion", "11:00", False, 3)
    assert r["decision"] == "RECHAZAR"


def test_agente_bloquea_acceso_masivo(agente):
    r = agente.procesar_solicitud(3, "MEDICO", "historia_clinica", "medico_tratante", "11:00", False, 80)
    assert r["nivel_alerta"] == "CRITICO" and r["decision"] == "RECHAZAR"


def test_agente_responde_en_menos_de_500ms(agente):
    r = agente.procesar_solicitud(4, "ENFERMERIA", "resultado_laboratorio", "personal_apoyo", "09:00", False, 6)
    assert r["tiempo_respuesta_ms"] < 500


def test_auditoria_registra_todo(agente):
    antes = agente.auditoria.estadisticas()["total_solicitudes"]
    agente.procesar_solicitud(5, "ADMIN", "orden_medica", "sin_relacion", "12:00", False, 2)
    assert agente.auditoria.estadisticas()["total_solicitudes"] == antes + 1


def test_nlp_interpreta_solicitud():
    r = interpretar("necesito la HC del paciente García")
    assert r["tipo_documento"] == "historia_clinica" and r["paciente"] == "García"
