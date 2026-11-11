"""
Evaluación ampliada del procesamiento de lenguaje natural.

Complementa las 40 frases de evaluar.py (solicitudes bien formadas) con 60 frases nuevas, redactadas
ANTES de ejecutar el módulo y agrupadas en seis categorías de dificultad. Para cada frase se define el
resultado esperado:
  - tipo de documento esperado (None si la frase no menciona un documento o menciona varios: lo correcto
    es pedir una aclaración, no adivinar),
  - paciente esperado (None si la frase no lo menciona).

Uso:  python -m src.evaluar_nlp_ampliado      (genera reports/evaluacion_nlp_ampliada.json)
"""
import json
from collections import defaultdict

from .config import REPORTS_DIR
from .evaluar import FRASES_NLP
from .nlp import interpretar

H, L, O = "historia_clinica", "resultado_laboratorio", "orden_medica"

FRASES_AMPLIADAS = [
    # 1) Errores ortográficos y de tipeo
    ("ortografia", "nesecito la istoria clinica de Juan Perez", H, "Juan Perez"),
    ("ortografia", "quiero ver la hitoria de Rosa Quispe", H, "Rosa Quispe"),
    ("ortografia", "resultado de laboratrio de Ana Flores", L, "Ana Flores"),
    ("ortografia", "dame los examenes de Pedro Castillo", L, "Pedro Castillo"),
    ("ortografia", "la recta de Mateo Perez", O, "Mateo Perez"),
    ("ortografia", "historia clinca de Lucia Torres", H, "Lucia Torres"),
    ("ortografia", "ver el espediente de Carmen Huaman", H, "Carmen Huaman"),
    ("ortografia", "analisis de sangre de Kevin Ortiz", L, "Kevin Ortiz"),
    ("ortografia", "orden medcia de Hugo Torres", O, "Hugo Torres"),
    ("ortografia", "HISTORIA CLINICA DE MARIA QUISPE", H, "Maria Quispe"),
    # 2) Sinónimos y expresiones coloquiales no incluidos en el diccionario
    ("coloquial", "los labs de Juan Perez", L, "Juan Perez"),
    ("coloquial", "lo que le recetaron a Luis Ramos", O, "Luis Ramos"),
    ("coloquial", "el informe de la eco de Milagros Paredes", L, "Milagros Paredes"),
    ("coloquial", "su ficha medica de Daniela Rojas", H, "Daniela Rojas"),
    ("coloquial", "los medicamentos que toma Elena Cruz", O, "Elena Cruz"),
    ("coloquial", "el perfil lipidico de Andrea Vega", L, "Andrea Vega"),
    ("coloquial", "su record medico de Diego Chavez", H, "Diego Chavez"),
    ("coloquial", "las placas de laboratorio de Sofia Mendoza", L, "Sofia Mendoza"),
    ("coloquial", "el historial de atenciones de Valeria Soto", H, "Valeria Soto"),
    ("coloquial", "la dosis indicada para Camila Torres", O, "Camila Torres"),
    # 3) Incompletas: indican el documento, pero no el paciente
    ("sin_paciente", "necesito una historia clinica", H, None),
    ("sin_paciente", "muestrame los resultados de laboratorio", L, None),
    ("sin_paciente", "quiero ver la receta", O, None),
    ("sin_paciente", "dame el expediente por favor", H, None),
    ("sin_paciente", "los analisis de hoy", L, None),
    ("sin_paciente", "la orden medica de la paciente", O, None),
    ("sin_paciente", "historia clinica urgente", H, None),
    ("sin_paciente", "necesito ver un hemograma", L, None),
    # 4) Ambiguas: indican el paciente, pero no el documento
    ("sin_documento", "quiero ver la informacion de Juan Perez", None, "Juan Perez"),
    ("sin_documento", "todo lo de Ana Flores", None, "Ana Flores"),
    ("sin_documento", "necesito revisar a Rosa Quispe", None, "Rosa Quispe"),
    ("sin_documento", "datos de 76543210", None, "76543210"),
    ("sin_documento", "abre lo de Mateo Perez", None, "Mateo Perez"),
    ("sin_documento", "que tiene Lucia Torres", None, "Lucia Torres"),
    ("sin_documento", "documentos de Pedro Castillo", None, "Pedro Castillo"),
    ("sin_documento", "el caso de Carmen Huaman", None, "Carmen Huaman"),
    # 5) Varios documentos en una sola frase (lo correcto es pedir que elija)
    ("varios_documentos", "la historia y los analisis de Juan Perez", None, "Juan Perez"),
    ("varios_documentos", "el laboratorio y la receta de Ana Flores", None, "Ana Flores"),
    ("varios_documentos", "expediente y ordenes de Rosa Quispe", None, "Rosa Quispe"),
    ("varios_documentos", "examenes e indicaciones de Mateo Perez", None, "Mateo Perez"),
    ("varios_documentos", "historia clinica y receta de Luis Ramos", None, "Luis Ramos"),
    ("varios_documentos", "quiero todo: hc, laboratorio y ordenes de Kevin Ortiz", None, "Kevin Ortiz"),
    # 6) Formatos de nombre y de DNI poco habituales
    ("formatos", "historia clinica de juan perez", H, "Juan Perez"),
    ("formatos", "hc de PEREZ, JUAN", H, "Perez Juan"),
    ("formatos", "resultados del dni 45.678.912", L, "45678912"),
    ("formatos", "receta de 4567891", O, None),
    ("formatos", "historia de la sra. Quispe", H, "Quispe"),
    ("formatos", "laboratorio de María José Fernández López", L, "María José Fernández López"),
    ("formatos", "la orden de De la Cruz", O, "De La Cruz"),
    ("formatos", "expediente de Ana", H, "Ana"),
    # 7) Negaciones, correcciones y frases largas
    ("negacion", "no la historia, solo la receta de Juan Perez", O, "Juan Perez"),
    ("negacion", "no quiero el laboratorio sino la historia de Ana Flores", H, "Ana Flores"),
    ("negacion", "perdon, me equivoque: la orden medica de Rosa Quispe", O, "Rosa Quispe"),
    ("negacion", "sin la historia completa, solo el hemograma de Lucia Torres", L, "Lucia Torres"),
    ("negacion", "buenas tardes doctora, para la consulta de las 3 necesito revisar el expediente de Pedro Castillo porque viene a control", H, "Pedro Castillo"),
    ("negacion", "hola, soy la enfermera de turno y necesito los examenes de Carmen Huaman para el triaje", L, "Carmen Huaman"),
    ("negacion", "solo para confirmar la dosis, la receta de Mateo Perez", O, "Mateo Perez"),
    ("negacion", "no es urgente, pero quisiera ver la historia de Kevin Ortiz", H, "Kevin Ortiz"),
    ("negacion", "el hemograma no, la historia clinica de Andrea Vega", H, "Andrea Vega"),
    ("negacion", "deme por favor la ficha de Elena Cruz que esta en observacion", H, "Elena Cruz"),
]


def _normal(s):
    from .nlp import normalizar
    return normalizar(s) if s else None


def evaluar():
    por_cat = defaultdict(lambda: {"total": 0, "documento_ok": 0, "paciente_ok": 0, "ambos_ok": 0})
    errores = []
    for cat, msg, tipo, pac in FRASES_AMPLIADAS:
        r = interpretar(msg)
        ok_doc = r["tipo_documento"] == tipo
        ok_pac = _normal(r["paciente"]) == _normal(pac)
        c = por_cat[cat]
        c["total"] += 1
        c["documento_ok"] += ok_doc
        c["paciente_ok"] += ok_pac
        c["ambos_ok"] += ok_doc and ok_pac
        if not (ok_doc and ok_pac):
            errores.append({"categoria": cat, "mensaje": msg, "esperado": [tipo, pac],
                            "obtenido": [r["tipo_documento"], r["paciente"]]})
    base = sum(interpretar(m)["tipo_documento"] == t and _normal(interpretar(m)["paciente"]) == _normal(p)
               for m, t, p in FRASES_NLP)
    total = {k: sum(v[k] for v in por_cat.values()) for k in ("total", "documento_ok", "paciente_ok", "ambos_ok")}
    return {"base_40": {"total": len(FRASES_NLP), "ambos_ok": int(base)}, "categorias": dict(por_cat),
            "total_ampliado": total, "errores": errores}


def main():
    res = evaluar()
    (REPORTS_DIR / "evaluacion_nlp_ampliada.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    for cat, v in res["categorias"].items():
        print(f"{cat:18s} {v['ambos_ok']:2d}/{v['total']:2d}  documento {v['documento_ok']}/{v['total']}  paciente {v['paciente_ok']}/{v['total']}")
    print("total ampliado:", res["total_ampliado"], "| base 40:", res["base_40"])
    for e in res["errores"]:
        print(e)


if __name__ == "__main__":
    main()
