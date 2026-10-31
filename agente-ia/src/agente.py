"""
Agente de IA para el control de acceso a documentos médicos (Algoritmo 1 del informe).

El agente PERCIBE la solicitud, la REPRESENTA como atributos, DECIDE con tres modelos en
secuencia y ACTÚA registrando y explicando su decisión:

  Fase 1  Árbol de Decisión     -> ¿tiene permiso según su rol, relación y contexto?
  Fase 2  Isolation Forest      -> ¿el comportamiento es anómalo aunque tenga permiso?
  Fase 3  Regresión Logística   -> en casos ambiguos, ¿qué tan probable es que sea legítima?

Uso:
    agente = AgenteAcceso()
    agente.procesar_solicitud(usuario_id=7, rol="medico", tipo_documento="historia_clinica",
                              relacion_paciente="medico_tratante", hora_acceso="10:30",
                              autorizacion_excepcional=False, frecuencia_accesos=6)
"""
import pickle
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import pandas as pd

from .auditoria import Auditoria
from .config import (MODELS_DIR, UMBRAL_ANOMALIA_ADVERTENCIA, UMBRAL_ANOMALIA_CRITICO, UMBRAL_LR_APROBACION,
                     UMBRAL_LR_AUTORIZAR, ZONA_HORARIA)
from .preprocesamiento import FEATURES_ARBOL, FEATURES_ISOLATION, FEATURES_LOGISTICA, NOMBRES_LEGIBLES
from .reglas import DECISIONES, DOCUMENTOS, EXPLICACION_REGLA, RELACIONES, ROLES, fuera_de_horario

# Roles del sistema CareNest -> roles del informe
ROL_SISTEMA = {"MEDICO": "medico", "ENFERMERIA": "enfermeria", "ADMISION": "administrativo", "ADMIN": "administrador"}
NOMBRE_DOCUMENTO = {"historia_clinica": "a la historia clínica", "resultado_laboratorio": "al resultado de laboratorio",
                    "orden_medica": "a la orden médica"}


def _num(x: float) -> str:
    return f"{x:.2f}".replace(".", ",")


def _hhmm(h: float) -> str:
    return f"{int(h):02d}:{int(round((h % 1) * 60)) % 60:02d}"


def _cargar(nombre: str):
    with open(MODELS_DIR / f"{nombre}.pkl", "rb") as f:
        return pickle.load(f)


class AgenteAcceso:
    def __init__(self, auditoria: Auditoria | None = None):
        self.arbol = _cargar("arbol_decision")
        self.iso_forest = _cargar("isolation_forest")
        self.regresion_logistica = _cargar("regresion_logistica")
        self.prep = _cargar("preprocesador")
        self.normalizador = _cargar("normalizador_anomalia")
        self.auditoria = auditoria or Auditoria()

    # ------------------------------------------------------------------ utilidades
    @staticmethod
    def normalizar_rol(rol: str) -> str:
        r = ROL_SISTEMA.get(rol.upper(), rol.lower()) if rol else rol
        if r not in ROLES:
            raise ValueError(f"Rol no reconocido: {rol}")
        return r

    @staticmethod
    def hora_actual() -> str:
        return datetime.now(ZoneInfo(ZONA_HORARIA)).strftime("%H:%M")

    def ruta_arbol(self, X: pd.DataFrame) -> list[str]:
        """Condiciones evaluadas por el árbol para esta solicitud, en lenguaje natural."""
        arbol = self.arbol.tree_
        nodos = self.arbol.decision_path(X[FEATURES_ARBOL]).indices
        pasos, hora_min, hora_max = [], None, None
        for nodo in nodos:
            if arbol.children_left[nodo] == arbol.children_right[nodo]:
                continue  # hoja
            feat = FEATURES_ARBOL[arbol.feature[nodo]]
            umbral = arbol.threshold[nodo]
            valor = X.iloc[0][feat]
            nombre = NOMBRES_LEGIBLES.get(feat, feat)
            if feat == "hora_num":   # las condiciones de hora se resumen en un solo intervalo
                if valor <= umbral:
                    hora_max = umbral if hora_max is None else min(hora_max, umbral)
                else:
                    hora_min = umbral if hora_min is None else max(hora_min, umbral)
            else:  # atributos binarios
                pasos.append(nombre if valor > umbral else f"no {nombre}")
        if hora_min is not None or hora_max is not None:
            ini = _hhmm(hora_min) if hora_min is not None else "00:00"
            fin = _hhmm(hora_max) if hora_max is not None else "23:59"
            pasos.append(f"hora entre {ini} y {fin}")
        return pasos

    def indice_legitimidad(self, X: pd.DataFrame) -> float:
        """Probabilidad de legitimidad a partir de la Regresión Logística multinomial.

        p = P(Autorizar) + 0,75 · P(Requiere aprobación)
        Una solicitud claramente autorizable obtiene p ≈ 1 (> 0,90), una que requiere aprobación p ≈ 0,75
        (entre 0,60 y 0,90) y una que debe rechazarse p ≈ 0 (< 0,60), coherente con los umbrales de la Tabla 9.
        """
        proba = self.regresion_logistica.predict_proba(X[FEATURES_LOGISTICA])[0]
        return float(proba[DECISIONES.index("AUTORIZAR")] + 0.75 * proba[DECISIONES.index("REQUIERE_APROBACION")])

    # ------------------------------------------------------------------ explicación
    @staticmethod
    def _explicacion(decision, decision_arbol, rol, relacion, tipo_documento, nivel, score, prob,
                     autorizacion_excepcional, hora, frecuencia) -> str:
        doc = NOMBRE_DOCUMENTO.get(tipo_documento, "al documento")
        motivo = EXPLICACION_REGLA.get((rol, relacion), "")
        if nivel == "CRITICO":
            return (f"Acceso bloqueado: se detectó un patrón de acceso anómalo (puntaje {_num(score)}; "
                    f"{frecuencia} solicitudes en la última hora, a las {hora}). Se notificó al administrador.")
        if decision == "AUTORIZAR":
            if autorizacion_excepcional and relacion != "medico_tratante":
                base = f"Acceso autorizado {doc}: cuentas con una autorización excepcional aprobada (acceso temporal)."
            else:
                base = f"Acceso autorizado {doc}: {motivo}."
            if nivel == "ADVERTENCIA":
                base += f" Se registró una advertencia por comportamiento inusual (puntaje {_num(score)})."
            return base
        if decision == "REQUIERE_APROBACION":
            if fuera_de_horario(int(hora[:2]) + int(hora[3:]) / 60) and decision_arbol != "RECHAZAR" \
                    and relacion != "medico_tratante" and rol in ("medico", "enfermeria"):
                razon = "la solicitud se realiza fuera del horario laboral"
            elif nivel == "ADVERTENCIA" and decision_arbol == "AUTORIZAR":
                razon = f"se detectó un comportamiento inusual (puntaje {_num(score)})"
            elif rol == "enfermeria" or (rol == "medico" and relacion == "personal_apoyo"):
                razon = "consultar la historia clínica completa requiere la aprobación del médico tratante o de la administración"
            else:
                razon = motivo
            extra = f" Probabilidad de legitimidad estimada: {prob:.0%}." if prob is not None else ""
            return f"Acceso pendiente de aprobación {doc}: {razon}.{extra} Puedes solicitar una autorización excepcional."
        # RECHAZAR
        return f"Acceso rechazado {doc}: {motivo}. Si lo necesitas para atender al paciente, solicita una autorización excepcional."

    # ------------------------------------------------------------------ Algoritmo 1
    def procesar_solicitud(self, usuario_id: int, rol: str, tipo_documento: str, relacion_paciente: str,
                           hora_acceso: str | None = None, autorizacion_excepcional: bool = False,
                           frecuencia_accesos: int | None = None, documento_id: int | None = None,
                           paciente_id: int | None = None, solicitud_texto: str | None = None,
                           registrar: bool = True) -> dict:
        inicio = time.perf_counter()
        rol = self.normalizar_rol(rol)
        if tipo_documento not in DOCUMENTOS:
            raise ValueError(f"Tipo de documento no reconocido: {tipo_documento}")
        if relacion_paciente not in RELACIONES:
            raise ValueError(f"Relación no reconocida: {relacion_paciente}")
        hora_acceso = hora_acceso or self.hora_actual()
        if frecuencia_accesos is None:
            frecuencia_accesos = self.auditoria.frecuencia_reciente(usuario_id)

        evento = {"rol_usuario": rol, "tipo_documento": tipo_documento, "relacion_paciente": relacion_paciente,
                  "hora_acceso": hora_acceso, "autorizacion_excepcional": int(bool(autorizacion_excepcional)),
                  "frecuencia_accesos": int(frecuencia_accesos)}
        X = self.prep.transform(pd.DataFrame([evento]))

        # FASE 1: Árbol de Decisión (permisos)
        decision_arbol = DECISIONES[int(self.arbol.predict(X[FEATURES_ARBOL])[0])]
        decision = decision_arbol

        # FASE 2: Isolation Forest (comportamiento); se calcula siempre para la auditoría
        score = float(self.normalizador.puntaje(self.iso_forest, X[FEATURES_ISOLATION])[0])
        if score > UMBRAL_ANOMALIA_CRITICO:
            nivel = "CRITICO"
        elif score >= UMBRAL_ANOMALIA_ADVERTENCIA:
            nivel = "ADVERTENCIA"
        else:
            nivel = "NORMAL"

        prob = None
        if decision_arbol != "RECHAZAR":
            if nivel == "CRITICO":
                decision = "RECHAZAR"
            # FASE 3: Regresión Logística (solo casos ambiguos)
            elif decision_arbol == "REQUIERE_APROBACION" or nivel == "ADVERTENCIA":
                prob = self.indice_legitimidad(X)
                if prob > UMBRAL_LR_AUTORIZAR and nivel != "ADVERTENCIA":
                    decision = "AUTORIZAR"
                elif prob >= UMBRAL_LR_APROBACION:
                    decision = "REQUIERE_APROBACION"  # un comportamiento inusual nunca se autoriza directamente
                else:
                    decision = "RECHAZAR"
        explicacion = self._explicacion(decision, decision_arbol, rol, relacion_paciente, tipo_documento, nivel,
                                        score, prob, autorizacion_excepcional, hora_acceso, frecuencia_accesos)
        ruta = self.ruta_arbol(X)
        tiempo_ms = (time.perf_counter() - inicio) * 1000

        resultado = {
            "decision": decision,
            "decision_arbol": decision_arbol,
            "score_anomalia": round(score, 4),
            "nivel_alerta": nivel,
            "prob_legitimidad": round(prob, 4) if prob is not None else None,
            "explicacion": explicacion,
            "ruta_arbol": ruta,
            "atributos": evento,
            "tiempo_respuesta_ms": round(tiempo_ms, 2),
            "id_log": None,
        }

        # AUDITORÍA (registro inmutable de toda solicitud)
        if registrar:
            id_log = self.auditoria.registrar(
                id_usuario=usuario_id, rol=rol, id_documento=documento_id, id_paciente=paciente_id,
                tipo_documento=tipo_documento, relacion_paciente=relacion_paciente, hora_acceso=hora_acceso,
                frecuencia_accesos=int(frecuencia_accesos), autorizacion_excepcional=bool(autorizacion_excepcional),
                decision=decision, decision_arbol=decision_arbol, score_anomalia=round(score, 4), nivel_alerta=nivel,
                prob_legitimidad=round(prob, 4) if prob is not None else None, explicacion=explicacion,
                solicitud_texto=solicitud_texto, tiempo_respuesta_ms=round(tiempo_ms, 2))
            resultado["id_log"] = id_log
            if nivel != "NORMAL":
                self.auditoria.registrar_alerta(id_log, usuario_id, round(score, 4), nivel,
                                                f"{rol}: {frecuencia_accesos} solicitudes/hora a las {hora_acceso} "
                                                f"({tipo_documento}, {relacion_paciente})")
        return resultado

