"""
Procesamiento de lenguaje natural (sección 3.6 del informe).

Convierte una solicitud escrita en español conversacional en atributos estructurados:
  - tipo de documento solicitado (diccionario de sinónimos médicos + stemming de NLTK),
  - paciente (DNI de 8 dígitos o nombre propio),
  - justificación declarada por el usuario (solo informativa: el agente NO confía en ella;
    la relación real con el paciente la calcula el sistema).

Ejemplo:
  "Necesito consultar la historia clínica del paciente Juan porque soy su médico tratante"
  -> {"tipo_documento": "historia_clinica", "paciente": "Juan", ...}
"""
import re
import unicodedata

from nltk.stem.snowball import SnowballStemmer

_stemmer = SnowballStemmer("spanish")

SINONIMOS = {
    "historia_clinica": ["historia clinica", "historia", "historial", "hc", "h.c.", "expediente", "ficha clinica",
                         "ficha", "antecedentes", "atenciones"],
    "resultado_laboratorio": ["resultado de laboratorio", "laboratorio", "lab", "resultado", "resultados", "examen",
                              "examenes", "analisis", "hemograma", "prueba", "pruebas", "ecografia", "glucosa"],
    "orden_medica": ["orden medica", "orden", "ordenes", "receta", "recetas", "prescripcion", "indicacion",
                     "indicaciones", "tratamiento", "medicacion"],
}
PALABRAS_VACIAS = {
    "quiero", "necesito", "dame", "deme", "muestrame", "mostrar", "ver", "consultar", "revisar", "abrir", "por", "favor",
    "la", "el", "los", "las", "de", "del", "al", "un", "una", "mi", "su", "sus", "porque", "soy", "es", "para", "con",
    "paciente", "pacienta", "senora", "senor", "sra", "sr", "nino", "nina", "bebe", "gestante", "hola", "buenos",
    "dias", "tardes", "noches", "acceso", "acceder", "puedo", "podria", "me", "y", "que", "en", "a", "o", "medico",
    "tratante", "enfermera", "enfermero", "urgente", "hoy", "clinica", "medica", "ultimo", "ultima", "ultimos",
}
_PATRON_JUSTIFICACION = re.compile(r"\b(porque|ya que|pues|debido a|para)\b(.+)$", re.IGNORECASE)
_PATRON_DNI = re.compile(r"\b(\d{8})\b")


def normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return sin_tildes.lower().strip()


def tokenizar(texto: str) -> list[str]:
    return re.findall(r"[a-z0-9\.]+", normalizar(texto))


def _detectar_documento(texto_norm: str, tokens: list[str]) -> tuple[str | None, float]:
    raices = {_stemmer.stem(t.strip(".")) for t in tokens}
    puntajes = {}
    for tipo, lista in SINONIMOS.items():
        p = 0.0
        for s in lista:
            if " " in s:
                if s in texto_norm:
                    p += 2.0             # frase completa: más confianza
            elif s.strip(".") in [t.strip(".") for t in tokens] or _stemmer.stem(s.strip(".")) in raices:
                p += 1.0
        puntajes[tipo] = p
    mejor = max(puntajes, key=puntajes.get)
    total = sum(puntajes.values())
    if puntajes[mejor] == 0:
        return None, 0.0
    return mejor, round(puntajes[mejor] / total, 2)


def _detectar_paciente(texto: str) -> str | None:
    dni = _PATRON_DNI.search(texto)
    if dni:
        return dni.group(1)
    # Se toma el texto antes de la justificación ("porque...") para no confundir nombres
    principal = _PATRON_JUSTIFICACION.split(texto)[0] if _PATRON_JUSTIFICACION.search(texto) else texto
    vocab_doc = {normalizar(w) for lista in SINONIMOS.values() for frase in lista for w in frase.split()}
    palabras = re.findall(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]+", principal)
    candidatos, actual = [], []
    for i, w in enumerate(palabras):
        n = normalizar(w)
        es_nombre = w[0].isupper() and n not in PALABRAS_VACIAS and n not in vocab_doc and not (i == 0 and n in PALABRAS_VACIAS)
        # una palabra en minúscula precedida por "paciente", "de", "del" también se acepta como nombre
        previa = normalizar(palabras[i - 1]) if i > 0 else ""
        if not es_nombre and previa in {"paciente", "de", "del", "senora", "senor", "sra", "sr"} \
                and n not in PALABRAS_VACIAS and n not in vocab_doc and len(n) > 2:
            es_nombre = True
        # continuación de un nombre ya iniciado ("lucia torres")
        if not es_nombre and actual and n not in PALABRAS_VACIAS and n not in vocab_doc and len(n) > 2:
            es_nombre = True
        if es_nombre and i == 0 and n in PALABRAS_VACIAS:
            es_nombre = False
        if es_nombre:
            actual.append(w.capitalize() if w.islower() else w)
        elif actual:
            candidatos.append(" ".join(actual))
            actual = []
    if actual:
        candidatos.append(" ".join(actual))
    candidatos = [c for c in candidatos if normalizar(c) not in PALABRAS_VACIAS]
    return candidatos[-1] if candidatos else None


def interpretar(mensaje: str) -> dict:
    """Interpreta una solicitud de acceso escrita en español."""
    texto_norm = normalizar(mensaje)
    tokens = tokenizar(mensaje)
    tipo, confianza = _detectar_documento(texto_norm, tokens)
    paciente = _detectar_paciente(mensaje)
    just = _PATRON_JUSTIFICACION.search(mensaje)
    return {
        "mensaje": mensaje,
        "tokens": tokens,
        "tipo_documento": tipo,
        "confianza_documento": confianza,
        "paciente": paciente,
        "es_dni": bool(paciente and paciente.isdigit()),
        "justificacion": just.group(2).strip() if just else None,
        "completo": tipo is not None and paciente is not None,
    }
