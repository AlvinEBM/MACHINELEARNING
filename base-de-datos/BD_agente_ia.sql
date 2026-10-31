-- =================================================================
-- MIGRACIÓN: Agente de IA para control de acceso a documentos médicos
-- Ejecutar DESPUÉS de BDActualizado.sql, sobre la misma base.
-- Se puede volver a ejecutar completo sin errores (verifica lo que ya existe).
-- Si tu base tiene otro nombre, cámbialo solo en la línea USE.
--
-- Agrega:
--   1) Rol ENFERMERIA en usuarios
--   2) Vínculo usuario <-> médico (medicos.id_usuario)
--   3) documentos         -> historias clínicas, resultados de laboratorio y órdenes médicas
--   4) access_requests    -> solicitudes de autorización excepcional
--   5) access_logs        -> auditoría inmutable de cada decisión del agente
--   6) anomaly_alerts     -> alertas de comportamiento anómalo
--   7) Datos de prueba (personal, pacientes, documentos y citas) — todos ficticios
--
-- Usuarios nuevos (contraseña de todos: admin123):
--   carlos.lopez@carenest.pe    MEDICO      (Medicina General)
--   maria.gonzales@carenest.pe  MEDICO      (Pediatría)
--   rosa.fernandez@carenest.pe  MEDICO      (Obstetricia)
--   elena.torres@carenest.pe    ENFERMERIA
--   maria.quispe@gmail.com      PACIENTE (gestante)
--   ana.flores@gmail.com        PACIENTE
-- =================================================================
USE MachineCitasMedicasSanGenaro;
SET NAMES utf8mb4;
SET SQL_SAFE_UPDATES = 0;   -- MySQL Workbench bloquea los UPDATE sin clave primaria

-- -----------------------------------------------------------------
-- 1) Rol ENFERMERIA
-- -----------------------------------------------------------------
ALTER TABLE `usuarios`
  MODIFY COLUMN `rol` enum('PACIENTE','ADMIN','ADMISION','MEDICO','ENFERMERIA') NOT NULL;

-- -----------------------------------------------------------------
-- 2) Cada usuario MEDICO se vincula con su registro en medicos
-- -----------------------------------------------------------------
-- (cada paso se ejecuta solo si todavía no existe)
SET @existe = (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicos' AND COLUMN_NAME = 'id_usuario');
SET @sql = IF(@existe = 0, 'ALTER TABLE `medicos` ADD COLUMN `id_usuario` int DEFAULT NULL', 'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @existe = (SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicos' AND INDEX_NAME = 'uk_medico_usuario');
SET @sql = IF(@existe = 0, 'ALTER TABLE `medicos` ADD UNIQUE KEY `uk_medico_usuario` (`id_usuario`)', 'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @existe = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicos' AND CONSTRAINT_NAME = 'medicos_ibfk_usuario');
SET @sql = IF(@existe = 0, 'ALTER TABLE `medicos` ADD CONSTRAINT `medicos_ibfk_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`)', 'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -----------------------------------------------------------------
-- 3) DOCUMENTOS MÉDICOS
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `documentos` (
  `id_documento`        int NOT NULL AUTO_INCREMENT,
  `id_paciente`         int NOT NULL,                 -- usuario titular (PACIENTE)
  `id_dependiente`      int DEFAULT NULL,             -- si el documento es de un dependiente (menor)
  `tipo_documento`      enum('historia_clinica','resultado_laboratorio','orden_medica') NOT NULL,
  `titulo`              varchar(150) NOT NULL,
  `contenido`           text NOT NULL,
  `id_medico_tratante`  int NOT NULL,
  `fecha_creacion`      timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_documento`),
  KEY `idx_doc_paciente` (`id_paciente`),
  KEY `idx_doc_tratante` (`id_medico_tratante`),
  CONSTRAINT `documentos_ibfk_paciente`    FOREIGN KEY (`id_paciente`)        REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `documentos_ibfk_dependiente` FOREIGN KEY (`id_dependiente`)     REFERENCES `dependientes` (`id_dependiente`),
  CONSTRAINT `documentos_ibfk_tratante`    FOREIGN KEY (`id_medico_tratante`) REFERENCES `medicos` (`id_medico`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------
-- 4) SOLICITUDES DE AUTORIZACIÓN EXCEPCIONAL
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `access_requests` (
  `id_solicitud`      int NOT NULL AUTO_INCREMENT,
  `id_usuario`        int NOT NULL,
  `id_documento`      int NOT NULL,
  `motivo`            text NOT NULL,
  `estado`            enum('PENDIENTE','APROBADA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  `id_aprobador`      int DEFAULT NULL,
  `fecha_solicitud`   timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_respuesta`   datetime DEFAULT NULL,
  `fecha_expiracion`  datetime DEFAULT NULL,           -- el acceso aprobado es temporal (24 h)
  PRIMARY KEY (`id_solicitud`),
  KEY `idx_req_usuario_doc` (`id_usuario`, `id_documento`),
  CONSTRAINT `access_requests_ibfk_usuario`   FOREIGN KEY (`id_usuario`)   REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `access_requests_ibfk_documento` FOREIGN KEY (`id_documento`) REFERENCES `documentos` (`id_documento`),
  CONSTRAINT `access_requests_ibfk_aprobador` FOREIGN KEY (`id_aprobador`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------
-- 5) AUDITORÍA (la escribe el microservicio Python del agente)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `access_logs` (
  `id_log`                    int NOT NULL AUTO_INCREMENT,
  `id_usuario`                int NOT NULL,
  `rol`                       varchar(30) NOT NULL,
  `id_documento`              int DEFAULT NULL,
  `id_paciente`               int DEFAULT NULL,
  `tipo_documento`            varchar(40) NOT NULL,
  `relacion_paciente`         varchar(30) NOT NULL,
  `hora_acceso`               varchar(5) NOT NULL,
  `frecuencia_accesos`        int NOT NULL,
  `autorizacion_excepcional`  tinyint(1) NOT NULL DEFAULT 0,
  `decision`                  enum('AUTORIZAR','RECHAZAR','REQUIERE_APROBACION') NOT NULL,
  `decision_arbol`            enum('AUTORIZAR','RECHAZAR','REQUIERE_APROBACION') NOT NULL,
  `score_anomalia`            float NOT NULL,
  `nivel_alerta`              varchar(15) NOT NULL,
  `prob_legitimidad`          float DEFAULT NULL,
  `explicacion`               text NOT NULL,
  `solicitud_texto`           text,
  `tiempo_respuesta_ms`       float NOT NULL,
  `fecha`                     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_log`),
  KEY `idx_logs_usuario_fecha` (`id_usuario`, `fecha`),
  KEY `idx_logs_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `anomaly_alerts` (
  `id_alerta`       int NOT NULL AUTO_INCREMENT,
  `id_log`          int NOT NULL,
  `id_usuario`      int NOT NULL,
  `score_anomalia`  float NOT NULL,
  `nivel`           varchar(15) NOT NULL,
  `descripcion`     text NOT NULL,
  `revisada`        tinyint(1) NOT NULL DEFAULT 0,
  `fecha`           datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_alerta`),
  KEY `idx_alerta_log` (`id_log`),
  CONSTRAINT `anomaly_alerts_ibfk_log` FOREIGN KEY (`id_log`) REFERENCES `access_logs` (`id_log`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Registro inmutable: nadie puede modificar ni borrar la auditoría
DROP TRIGGER IF EXISTS `trg_access_logs_no_update`;
CREATE TRIGGER `trg_access_logs_no_update` BEFORE UPDATE ON `access_logs`
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'access_logs es inmutable: no se permite modificar registros de auditoria';

DROP TRIGGER IF EXISTS `trg_access_logs_no_delete`;
CREATE TRIGGER `trg_access_logs_no_delete` BEFORE DELETE ON `access_logs`
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'access_logs es inmutable: no se permite borrar registros de auditoria';

-- =================================================================
-- DATOS DE PRUEBA (ficticios)
-- =================================================================

-- ---------- Personal y pacientes (contraseña: admin123) ----------
INSERT IGNORE INTO `usuarios` (correo, contrasena, rol, dni, nombres, apellidos, telefono, fecha_nacimiento, direccion, genero) VALUES
('carlos.lopez@carenest.pe',   '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'MEDICO',     '40000001', 'Carlos', 'Lopez',     '911111111', NULL, NULL, 'Masculino'),
('maria.gonzales@carenest.pe', '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'MEDICO',     '40000002', 'Maria',  'Gonzales',  '922222222', NULL, NULL, 'Femenino'),
('rosa.fernandez@carenest.pe', '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'MEDICO',     '40000004', 'Rosa',   'Fernandez', '944444444', NULL, NULL, 'Femenino'),
('elena.torres@carenest.pe',   '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'ENFERMERIA', '40000005', 'Elena',  'Torres',    '955555555', NULL, NULL, 'Femenino'),
('maria.quispe@gmail.com',     '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'PACIENTE',   '71234567', 'Maria',  'Quispe',    '966666666', '1998-09-21', 'Jr. Las Gardenias 450', 'Femenino'),
('ana.flores@gmail.com',       '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'PACIENTE',   '72345678', 'Ana',    'Flores',    '977777777', '2001-02-11', 'Av. Defensores 820', 'Femenino');

UPDATE `medicos` SET id_usuario = (SELECT id_usuario FROM usuarios WHERE correo = 'carlos.lopez@carenest.pe')   WHERE nombres = 'Carlos' AND apellidos = 'Lopez';
UPDATE `medicos` SET id_usuario = (SELECT id_usuario FROM usuarios WHERE correo = 'maria.gonzales@carenest.pe') WHERE nombres = 'Maria'  AND apellidos = 'Gonzales';
UPDATE `medicos` SET id_usuario = (SELECT id_usuario FROM usuarios WHERE correo = 'rosa.fernandez@carenest.pe') WHERE nombres = 'Rosa'   AND apellidos = 'Fernandez';

-- Hijo de Juan Perez (dependiente menor de edad)
INSERT INTO `dependientes` (id_usuario, nombres, apellidos, dni, fecha_nacimiento, parentesco)
SELECT id_usuario, 'Mateo', 'Perez', '91234567', '2022-05-03', 'Hijo' FROM usuarios
WHERE correo = 'juan@gmail.com' AND NOT EXISTS (SELECT 1 FROM dependientes WHERE dni = '91234567');

-- ---------- Documentos médicos (contenido ficticio) ----------
-- Variables auxiliares
SET @juan   = (SELECT id_usuario FROM usuarios WHERE correo = 'juan@gmail.com');
SET @mquis  = (SELECT id_usuario FROM usuarios WHERE correo = 'maria.quispe@gmail.com');
SET @aflo   = (SELECT id_usuario FROM usuarios WHERE correo = 'ana.flores@gmail.com');
SET @mateo  = (SELECT MIN(id_dependiente) FROM dependientes WHERE dni = '91234567');
SET @m_gen  = (SELECT id_medico FROM medicos WHERE nombres = 'Carlos' AND apellidos = 'Lopez');
SET @m_ped  = (SELECT id_medico FROM medicos WHERE nombres = 'Maria'  AND apellidos = 'Gonzales');
SET @m_obs  = (SELECT id_medico FROM medicos WHERE nombres = 'Rosa'   AND apellidos = 'Fernandez');
SET @m_enf  = (SELECT id_medico FROM medicos WHERE nombres = 'Pedro'  AND apellidos = 'Sanchez');

-- Solo se insertan si la tabla documentos está vacía (evita duplicados al volver a ejecutar)
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_documentos LIKE documentos;
TRUNCATE TABLE tmp_documentos;
INSERT INTO tmp_documentos (id_paciente, id_dependiente, tipo_documento, titulo, contenido, id_medico_tratante) VALUES
(@juan,  NULL,   'historia_clinica',      'Historia clínica - Juan Perez',
 'Antecedentes: sin alergias conocidas. Motivo de consulta: cefalea tensional. Diagnóstico presuntivo: cefalea tensional episódica. Plan: analgesia y control en 2 semanas. (Datos ficticios)', @m_gen),
(@juan,  NULL,   'resultado_laboratorio', 'Hemograma completo - Juan Perez',
 'Hemoglobina 14.8 g/dL; Leucocitos 7 200/mm3; Plaquetas 250 000/mm3. Valores dentro de rangos de referencia. (Datos ficticios)', @m_gen),
(@juan,  NULL,   'orden_medica',          'Orden médica - Juan Perez',
 'Paracetamol 500 mg vía oral cada 8 horas por 3 días. Control en consultorio de Medicina General. (Datos ficticios)', @m_gen),
(@juan,  @mateo, 'historia_clinica',      'Historia clínica pediátrica - Mateo Perez',
 'Control de crecimiento y desarrollo: peso y talla adecuados para la edad. Vacunas al día. (Datos ficticios)', @m_ped),
(@juan,  @mateo, 'resultado_laboratorio', 'Examen de orina - Mateo Perez',
 'Examen completo de orina sin alteraciones. (Datos ficticios)', @m_ped),
(@mquis, NULL,   'historia_clinica',      'Historia clínica obstétrica - Maria Quispe',
 'Gestante de 24 semanas. Control prenatal n.º 5. Presión arterial 110/70 mmHg. Altura uterina acorde a edad gestacional. (Datos ficticios)', @m_obs),
(@mquis, NULL,   'resultado_laboratorio', 'Ecografía obstétrica - Maria Quispe',
 'Feto único, activo, latidos cardíacos presentes. Placenta normoinserta. Líquido amniótico normal. (Datos ficticios)', @m_obs),
(@mquis, NULL,   'orden_medica',          'Indicaciones prenatales - Maria Quispe',
 'Sulfato ferroso 300 mg diario. Ácido fólico 0.5 mg diario. Próximo control en 4 semanas. (Datos ficticios)', @m_obs),
(@aflo,  NULL,   'historia_clinica',      'Historia clínica - Ana Flores',
 'Consulta por dolor abdominal leve. Examen físico sin signos de alarma. (Datos ficticios)', @m_gen),
(@aflo,  NULL,   'resultado_laboratorio', 'Glucosa en ayunas - Ana Flores',
 'Glucosa basal 88 mg/dL (rango normal). (Datos ficticios)', @m_gen);

INSERT INTO documentos (id_paciente, id_dependiente, tipo_documento, titulo, contenido, id_medico_tratante)
SELECT id_paciente, id_dependiente, tipo_documento, titulo, contenido, id_medico_tratante
FROM tmp_documentos
WHERE NOT EXISTS (SELECT 1 FROM documentos);
DROP TEMPORARY TABLE IF EXISTS tmp_documentos;

-- ---------- Citas que generan relaciones de "personal de apoyo" ----------
-- La pediatra atendió antes a Maria Quispe (interconsulta) -> es personal de apoyo para ella
INSERT IGNORE INTO `horarios` (id_medico, fecha, hora, tipo_visita, disponible) VALUES
(@m_ped, CURDATE() - INTERVAL 10 DAY, '09:00:00', 'PRESENCIAL', 0),
(@m_enf, CURDATE(),                   '08:30:00', 'PRESENCIAL', 0),
(@m_enf, CURDATE(),                   '09:00:00', 'PRESENCIAL', 0);

INSERT IGNORE INTO `citas` (id_usuario, id_horario, id_dependiente, motivo, estado)
SELECT @mquis, id_horario, NULL, 'Interconsulta pediátrica prenatal', 'COMPLETADA'
FROM horarios WHERE id_medico = @m_ped AND fecha = CURDATE() - INTERVAL 10 DAY AND hora = '09:00:00';

-- Citas de hoy en triaje (enfermería atiende a Juan y a Maria Quispe)
INSERT IGNORE INTO `citas` (id_usuario, id_horario, id_dependiente, motivo, estado)
SELECT @juan, id_horario, NULL, 'Triaje y signos vitales', 'CONFIRMADA'
FROM horarios WHERE id_medico = @m_enf AND fecha = CURDATE() AND hora = '08:30:00';

INSERT IGNORE INTO `citas` (id_usuario, id_horario, id_dependiente, motivo, estado)
SELECT @mquis, id_horario, NULL, 'Triaje prenatal', 'CONFIRMADA'
FROM horarios WHERE id_medico = @m_enf AND fecha = CURDATE() AND hora = '09:00:00';

-- =================================================================
-- VERIFICACIÓN (resultado esperado: 10 documentos, 2 triggers, 3 médicos vinculados)
SELECT COUNT(*) AS documentos FROM documentos;
SELECT COUNT(*) AS triggers FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'access_logs';
SELECT COUNT(*) AS medicos_vinculados FROM medicos WHERE id_usuario IS NOT NULL;

-- FIN DE LA MIGRACIÓN
SET SQL_SAFE_UPDATES = 1;
--
-- =================================================================
