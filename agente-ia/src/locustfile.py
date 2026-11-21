"""
Simulación de trabajadores del establecimiento con Locust (modelo de carga con pausas, más realista que la prueba
cerrada de src/prueba_carga.py).

Cada usuario virtual representa a un trabajador con su propio id: envía una solicitud de acceso, espera la
respuesta y luego hace una pausa ("tiempo de reflexión") con distribución exponencial, como ocurre cuando lee el
documento o atiende al paciente antes de la siguiente consulta. La tasa de llegada resultante es aproximadamente
N / PAUSA_MEDIA_S solicitudes por segundo.

Uso (con la API en ejecución sobre MySQL):
    locust -f src/locustfile.py --host http://127.0.0.1:8000 --headless -u 200 -r 50 -t 120s \
           --reset-stats --csv reports/locust_200
Variables de entorno:
    PAUSA_MEDIA_S   pausa media entre solicitudes de un mismo trabajador (por defecto 10 s)
"""
import itertools
import os
import random
import time

import pandas as pd
from locust import HttpUser, task

from src.config import DATA_DIR

ROL_API = {"medico": "MEDICO", "enfermeria": "ENFERMERIA", "administrativo": "ADMISION", "administrador": "ADMIN"}
PAUSA_MEDIA_S = float(os.getenv("PAUSA_MEDIA_S", "10"))
_ESC = pd.read_csv(DATA_DIR / "escenarios_evaluacion.csv")
_IDS = itertools.count(2000)


class Trabajador(HttpUser):
    def wait_time(self):
        return random.expovariate(1 / PAUSA_MEDIA_S)

    def on_start(self):
        self.id_usuario = next(_IDS)
        self.rng = random.Random(self.id_usuario)
        # los trabajadores no empiezan todos en el mismo instante: primera pausa aleatoria
        time.sleep(random.uniform(0, PAUSA_MEDIA_S))

    @task
    def solicitar_documento(self):
        r = _ESC.iloc[self.rng.randrange(len(_ESC))]
        self.client.post("/api/evaluaracceso", name="evaluaracceso", json={
            "usuario_id": self.id_usuario, "rol": ROL_API[r.rol_usuario], "tipo_documento": r.tipo_documento,
            "relacion_paciente": r.relacion_paciente, "autorizacion_excepcional": bool(r.autorizacion_excepcional),
            "hora_acceso": r.hora_acceso})
