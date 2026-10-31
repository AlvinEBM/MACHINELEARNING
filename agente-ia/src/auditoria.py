"""
Módulo de auditoría (sección 3.6 del informe).

Registra de forma inmutable cada solicitud evaluada por el agente en la tabla access_logs, y las
alertas de comportamiento anómalo en anomaly_alerts. Usa SQLAlchemy, por lo que funciona con
SQLite (desarrollo) y con MySQL/PostgreSQL (integración), según AGENTE_DB_URL.

En MySQL, las tablas se crean con el script BD_agente_ia.sql, que además añade triggers que
impiden modificar o borrar registros de auditoría.
"""
from datetime import datetime, timedelta

from sqlalchemy import (Boolean, Column, DateTime, Enum, Float, Integer, String, Text, create_engine, func,
                        select)
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DB_URL, VENTANA_FRECUENCIA_MIN

Base = declarative_base()
DECISION_ENUM = Enum("AUTORIZAR", "RECHAZAR", "REQUIERE_APROBACION", name="decision_acceso")


class AccessLog(Base):
    __tablename__ = "access_logs"

    id_log = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(Integer, nullable=False, index=True)
    rol = Column(String(30), nullable=False)
    id_documento = Column(Integer, nullable=True)
    id_paciente = Column(Integer, nullable=True)
    tipo_documento = Column(String(40), nullable=False)
    relacion_paciente = Column(String(30), nullable=False)
    hora_acceso = Column(String(5), nullable=False)
    frecuencia_accesos = Column(Integer, nullable=False)
    autorizacion_excepcional = Column(Boolean, nullable=False, default=False)
    decision = Column(DECISION_ENUM, nullable=False)
    decision_arbol = Column(DECISION_ENUM, nullable=False)
    score_anomalia = Column(Float, nullable=False)
    nivel_alerta = Column(String(15), nullable=False)
    prob_legitimidad = Column(Float, nullable=True)
    explicacion = Column(Text, nullable=False)
    solicitud_texto = Column(Text, nullable=True)
    tiempo_respuesta_ms = Column(Float, nullable=False)
    fecha = Column(DateTime, nullable=False, default=datetime.now, index=True)


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id_alerta = Column(Integer, primary_key=True, autoincrement=True)
    id_log = Column(Integer, nullable=False)
    id_usuario = Column(Integer, nullable=False)
    score_anomalia = Column(Float, nullable=False)
    nivel = Column(String(15), nullable=False)
    descripcion = Column(Text, nullable=False)
    revisada = Column(Boolean, nullable=False, default=False)
    fecha = Column(DateTime, nullable=False, default=datetime.now)


class Auditoria:
    def __init__(self, db_url: str = DB_URL):
        conexion = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        self.engine = create_engine(db_url, connect_args=conexion, pool_pre_ping=True)
        Base.metadata.create_all(self.engine)  # solo crea las tablas que no existen
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)

    def registrar(self, **datos) -> int:
        with self.Session() as s:
            log = AccessLog(**datos)
            s.add(log)
            s.commit()
            return log.id_log

    def registrar_alerta(self, id_log: int, id_usuario: int, score: float, nivel: str, descripcion: str) -> int:
        with self.Session() as s:
            alerta = AnomalyAlert(id_log=id_log, id_usuario=id_usuario, score_anomalia=score,
                                  nivel=nivel, descripcion=descripcion)
            s.add(alerta)
            s.commit()
            return alerta.id_alerta

    def frecuencia_reciente(self, id_usuario: int, ahora: datetime | None = None) -> int:
        """Número de solicitudes del usuario en la última hora, incluida la actual."""
        ahora = ahora or datetime.now()
        desde = ahora - timedelta(minutes=VENTANA_FRECUENCIA_MIN)
        with self.Session() as s:
            n = s.scalar(select(func.count(AccessLog.id_log)).where(
                AccessLog.id_usuario == id_usuario, AccessLog.fecha >= desde))
        return int(n or 0) + 1

    def ultimos(self, limite: int = 50) -> list[dict]:
        with self.Session() as s:
            filas = s.scalars(select(AccessLog).order_by(AccessLog.id_log.desc()).limit(limite)).all()
        return [_a_dict(f) for f in filas]

    def alertas(self, limite: int = 50, solo_pendientes: bool = False) -> list[dict]:
        with self.Session() as s:
            q = select(AnomalyAlert).order_by(AnomalyAlert.id_alerta.desc()).limit(limite)
            if solo_pendientes:
                q = q.where(AnomalyAlert.revisada.is_(False))
            filas = s.scalars(q).all()
        return [_a_dict(f) for f in filas]

    def marcar_alerta_revisada(self, id_alerta: int) -> bool:
        with self.Session() as s:
            alerta = s.get(AnomalyAlert, id_alerta)
            if alerta is None:
                return False
            alerta.revisada = True
            s.commit()
            return True

    def estadisticas(self) -> dict:
        with self.Session() as s:
            total = s.scalar(select(func.count(AccessLog.id_log))) or 0
            por_decision = dict(s.execute(select(AccessLog.decision, func.count()).group_by(AccessLog.decision)).all())
            por_rol = dict(s.execute(select(AccessLog.rol, func.count()).group_by(AccessLog.rol)).all())
            por_nivel = dict(s.execute(select(AccessLog.nivel_alerta, func.count()).group_by(AccessLog.nivel_alerta)).all())
            t_prom = s.scalar(select(func.avg(AccessLog.tiempo_respuesta_ms))) or 0
            t_max = s.scalar(select(func.max(AccessLog.tiempo_respuesta_ms))) or 0
            hace_24h = datetime.now() - timedelta(hours=24)
            ultimas_24h = s.scalar(select(func.count(AccessLog.id_log)).where(AccessLog.fecha >= hace_24h)) or 0
            alertas_pend = s.scalar(select(func.count(AnomalyAlert.id_alerta)).where(AnomalyAlert.revisada.is_(False))) or 0
        return {
            "total_solicitudes": int(total),
            "ultimas_24h": int(ultimas_24h),
            "por_decision": {k: int(v) for k, v in por_decision.items()},
            "por_rol": {k: int(v) for k, v in por_rol.items()},
            "por_nivel_alerta": {k: int(v) for k, v in por_nivel.items()},
            "alertas_pendientes": int(alertas_pend),
            "tiempo_respuesta_promedio_ms": round(float(t_prom), 2),
            "tiempo_respuesta_maximo_ms": round(float(t_max), 2),
        }


def _a_dict(obj) -> dict:
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat(timespec="seconds")
    return d
