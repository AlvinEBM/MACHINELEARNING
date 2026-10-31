"""
Matriz de roles y permisos (RBAC contextual) del Centro de Salud Materno Infantil San Genaro de Villa.

Este módulo define la ETIQUETA ESPERADA de cada evento de acceso. Se usa:
  1. para etiquetar el dataset sintético ANTES de entrenar (evita sesgo de verificación), y
  2. como referencia contra la cual se comparan las decisiones del agente.

Corresponde a la Figura 1 (matriz de roles y permisos) del informe.
"""

ROLES = ["medico", "enfermeria", "administrativo", "administrador"]
DOCUMENTOS = ["historia_clinica", "resultado_laboratorio", "orden_medica"]
RELACIONES = ["medico_tratante", "personal_apoyo", "sin_relacion"]
DECISIONES = ["RECHAZAR", "AUTORIZAR", "REQUIERE_APROBACION"]  # códigos 0, 1, 2

HORA_INICIO_LABORAL = 7.0   # 07:00
HORA_FIN_LABORAL = 20.0     # 20:00


def fuera_de_horario(hora: float) -> bool:
    """True si la hora (decimal, p. ej. 14.5 = 14:30) está fuera del horario laboral."""
    return hora < HORA_INICIO_LABORAL or hora >= HORA_FIN_LABORAL


def decision_esperada(rol: str, tipo_documento: str, relacion: str,
                      hora: float, autorizacion_excepcional: int) -> str:
    """Devuelve la decisión correcta según la matriz de roles y permisos.

    Reglas (resumen):
      - Médico tratante: autoriza cualquier documento.
      - Médico de apoyo (atendió al paciente): laboratorio y órdenes sí; historia clínica requiere aprobación.
      - Médico sin relación: rechaza, salvo autorización excepcional aprobada.
      - Enfermería de apoyo: laboratorio y órdenes sí; historia clínica requiere aprobación.
      - Enfermería sin relación: rechaza, salvo autorización excepcional.
      - Administrativo: nunca accede directamente a información clínica; con autorización excepcional,
        la solicitud se deriva a aprobación.
      - Administrador: todo acceso clínico requiere aprobación (supervisión, no atención).
      - Fuera de horario, un acceso que se autorizaría a alguien que NO es el médico tratante
        pasa a requerir aprobación.
    """
    exc = bool(autorizacion_excepcional)

    if rol == "medico":
        if relacion == "medico_tratante":
            return "AUTORIZAR"
        if relacion == "personal_apoyo":
            if tipo_documento == "historia_clinica":
                decision = "AUTORIZAR" if exc else "REQUIERE_APROBACION"
            else:
                decision = "AUTORIZAR"
        else:  # sin_relacion
            decision = "AUTORIZAR" if exc else "RECHAZAR"

    elif rol == "enfermeria":
        if relacion in ("personal_apoyo", "medico_tratante"):
            if tipo_documento == "historia_clinica":
                decision = "AUTORIZAR" if exc else "REQUIERE_APROBACION"
            else:
                decision = "AUTORIZAR"
        else:
            decision = "AUTORIZAR" if exc else "RECHAZAR"

    elif rol == "administrativo":
        decision = "REQUIERE_APROBACION" if exc else "RECHAZAR"

    elif rol == "administrador":
        decision = "REQUIERE_APROBACION"

    else:
        decision = "RECHAZAR"

    # Restricción horaria: solo el médico tratante conserva el acceso directo fuera de horario
    if decision == "AUTORIZAR" and fuera_de_horario(hora) and not (rol == "medico" and relacion == "medico_tratante"):
        decision = "REQUIERE_APROBACION"

    return decision


EXPLICACION_REGLA = {
    ("medico", "medico_tratante"): "eres el médico tratante asignado",
    ("medico", "personal_apoyo"): "has atendido previamente al paciente",
    ("medico", "sin_relacion"): "no eres el médico tratante del paciente",
    ("enfermeria", "personal_apoyo"): "participas en la atención del paciente",
    ("enfermeria", "medico_tratante"): "participas en la atención del paciente",
    ("enfermeria", "sin_relacion"): "no participas en la atención del paciente",
    ("administrativo", "personal_apoyo"): "el personal administrativo no accede a información clínica",
    ("administrativo", "sin_relacion"): "el personal administrativo no accede a información clínica",
    ("administrativo", "medico_tratante"): "el personal administrativo no accede a información clínica",
    ("administrador", "personal_apoyo"): "el administrador supervisa, pero no atiende al paciente",
    ("administrador", "sin_relacion"): "el administrador supervisa, pero no atiende al paciente",
    ("administrador", "medico_tratante"): "el administrador supervisa, pero no atiende al paciente",
}
