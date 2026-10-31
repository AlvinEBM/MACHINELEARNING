-- =================================================================
-- BASE DE DATOS CareNest (desde cero)
-- ATENCIÓN: borra la base MachineCitasMedicasSanGenaro si ya existe
-- y la vuelve a crear vacía. Luego ejecutar BD_agente_ia.sql y
-- BD_muestra_pruebas.sql.
-- =================================================================
DROP DATABASE IF EXISTS MachineCitasMedicasSanGenaro;
CREATE DATABASE MachineCitasMedicasSanGenaro
 DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE MachineCitasMedicasSanGenaro;
CREATE TABLE  `usuarios` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `correo` varchar(100) NOT NULL,
  `contrasena` varchar(255) NOT NULL,
  `rol` enum('PACIENTE','ADMIN','ADMISION','MEDICO') NOT NULL,
  `dni` varchar(8) DEFAULT NULL,
  `nombres` varchar(100) DEFAULT NULL,
  `apellidos` varchar(100) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `direccion` varchar(200) DEFAULT NULL,
  `genero` enum('Masculino','Femenino','Otros') DEFAULT NULL,
  `inasistencias` tinyint unsigned DEFAULT 0,
  `cuenta_bloqueada` tinyint(1) DEFAULT 0,
  `intentos_fallidos` tinyint unsigned DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1,
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `correo` (`correo`),
  UNIQUE KEY `dni` (`dni`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 2) ESPECIALIDADES
-- =================================================================
CREATE TABLE `especialidades` (
  `id_especialidad` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text,
  `estado` enum('ACTIVA','INACTIVA') DEFAULT 'ACTIVA',
  PRIMARY KEY (`id_especialidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 3) MEDICOS  (cada médico pertenece a una especialidad)
-- =================================================================
CREATE TABLE `medicos` (
  `id_medico` int NOT NULL AUTO_INCREMENT,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `id_especialidad` int NOT NULL,
  PRIMARY KEY (`id_medico`),
  KEY `id_especialidad` (`id_especialidad`),
  CONSTRAINT `medicos_ibfk_1` FOREIGN KEY (`id_especialidad`)
    REFERENCES `especialidades` (`id_especialidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 4) DEPENDIENTES  (familiares a cargo de un paciente)
-- =================================================================
CREATE TABLE `dependientes` (
  `id_dependiente` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `nombres` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `dni` varchar(8) DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `parentesco` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id_dependiente`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `dependientes_ibfk_1` FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 5) HORARIOS
--    Con el Enfoque A1, los horarios se crean automáticamente al
--    momento de reservar. Esta tabla queda vacía al inicio.
-- =================================================================
CREATE TABLE `horarios` (
  `id_horario` int NOT NULL AUTO_INCREMENT,
  `id_medico` int NOT NULL,
  `fecha` date NOT NULL,
  `hora` time NOT NULL,
  `tipo_visita` enum('PRESENCIAL','VIRTUAL') DEFAULT 'PRESENCIAL',
  `disponible` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id_horario`),
  UNIQUE KEY `uk_medico_fecha_hora` (`id_medico`,`fecha`,`hora`),
  CONSTRAINT `horarios_ibfk_1` FOREIGN KEY (`id_medico`)
    REFERENCES `medicos` (`id_medico`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 6) FECHAS BLOQUEADAS  (feriados, días no laborables)
-- =================================================================
CREATE TABLE `fechas_bloqueadas` (
  `id_bloqueo` int NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `motivo` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id_bloqueo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 7) CITAS
-- =================================================================
CREATE TABLE `citas` (
  `id_cita` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `id_horario` int NOT NULL,
  `id_dependiente` int DEFAULT NULL,
  `motivo` text,
  `notas` text,
  `estado` enum('RESERVADA','CONFIRMADA','RECORDATORIO','COMPLETADA','CANCELADA','FALTA') DEFAULT 'RESERVADA',
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cita`),
  UNIQUE KEY `id_horario` (`id_horario`),
  KEY `id_usuario` (`id_usuario`),
  KEY `id_dependiente` (`id_dependiente`),
  CONSTRAINT `citas_ibfk_1` FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `citas_ibfk_2` FOREIGN KEY (`id_horario`)
    REFERENCES `horarios` (`id_horario`),
  CONSTRAINT `citas_ibfk_3` FOREIGN KEY (`id_dependiente`)
    REFERENCES `dependientes` (`id_dependiente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 8) HISTORIAL DE ASISTENCIA
-- =================================================================
CREATE TABLE `historial_asistencia` (
  `id_historial` int NOT NULL AUTO_INCREMENT,
  `id_cita` int NOT NULL,
  `id_usuario` int NOT NULL,
  `estado` enum('COMPLETADA','FALTA') NOT NULL,
  `fecha_registro` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_historial`),
  KEY `id_cita` (`id_cita`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `historial_ibfk_1` FOREIGN KEY (`id_cita`)
    REFERENCES `citas` (`id_cita`),
  CONSTRAINT `historial_ibfk_2` FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 9) NOTIFICACIONES
-- =================================================================
CREATE TABLE `notificaciones` (
  `id_notificacion` int NOT NULL AUTO_INCREMENT,
  `id_cita` int DEFAULT NULL,
  `id_usuario` int NOT NULL,
  `tipo` enum('RECORDATORIO','CANCELACION','BLOQUEO_CUENTA') NOT NULL,
  `mensaje` text NOT NULL,
  `enviado` tinyint(1) DEFAULT 0,
  `leida` tinyint(1) DEFAULT 0,
  `fecha_programada` datetime DEFAULT NULL,
  `fecha_envio` datetime DEFAULT NULL,
  PRIMARY KEY (`id_notificacion`),
  KEY `id_cita` (`id_cita`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `notificaciones_ibfk_1` FOREIGN KEY (`id_cita`)
    REFERENCES `citas` (`id_cita`),
  CONSTRAINT `notificaciones_ibfk_2` FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 10) CONFIGURACION DEL SISTEMA
-- =================================================================
CREATE TABLE `configuracion_sistema` (
  `id_config` int NOT NULL AUTO_INCREMENT,
  `clave` varchar(100) NOT NULL,
  `valor` varchar(255) NOT NULL,
  `descripcion` text,
  PRIMARY KEY (`id_config`),
  UNIQUE KEY `clave` (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =================================================================
-- 11) SESIONES
-- =================================================================
CREATE TABLE `sesiones` (
  `id_sesion` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `token` varchar(500) DEFAULT NULL,
  `fecha_inicio` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_expiracion` datetime DEFAULT NULL,
  PRIMARY KEY (`id_sesion`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `sesiones_ibfk_1` FOREIGN KEY (`id_usuario`)
    REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =================================================================
-- =================================================================
-- DATOS INICIALES (SEED)
-- =================================================================
-- =================================================================

-- ---------- USUARIOS (contraseña de todos: admin123) ----------
INSERT INTO `usuarios`
  (correo, contrasena, rol, dni, nombres, apellidos, telefono, fecha_nacimiento, direccion, genero)
VALUES
('admin@carenest.pe',     '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'ADMIN',    '00000001', 'Director', 'Principal', '999999999', NULL,         NULL,                 NULL),
('admision@carenest.pe',  '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'ADMISION', '00000002', 'Ana',      'Ventanilla','988888888', NULL,         NULL,                 NULL),
('juan@gmail.com',        '$2b$10$.TAwn4G3R.fzAZachB9bqux7uL/h310urEuJngYs.pIzqLTQnLNMe', 'PACIENTE', '76543210', 'Juan',     'Perez',     '987654321', '2003-04-15', 'Av. Los Olivos 123', 'Masculino');

-- ---------- ESPECIALIDADES ----------
INSERT INTO `especialidades` (nombre, descripcion, estado) VALUES
('Medicina General', 'Atención médica integral a los pacientes', 'ACTIVA'),
('Pediatria',        'Atención integral a niños y adolescentes', 'ACTIVA'),
('Psicologia',       'Evaluación, diagnóstico y orientación psicológica', 'ACTIVA'),
('Obstetricia',      'Control prenatal y planificación familiar', 'ACTIVA'),
('Enfermeria',       'Toma de signos vitales y triaje', 'ACTIVA');

-- ---------- MEDICOS (uno por especialidad) ----------
INSERT INTO `medicos` (nombres, apellidos, id_especialidad) VALUES
('Carlos', 'Lopez',     1),   -- Medicina General
('Maria',  'Gonzales',  2),   -- Pediatria
('Lucia',  'Ramirez',   3),   -- Psicologia
('Rosa',   'Fernandez', 4),   -- Obstetricia
('Pedro',  'Sanchez',   5);   -- Enfermeria

-- ---------- CONFIGURACION DEL SISTEMA ----------
INSERT INTO `configuracion_sistema` (clave, valor, descripcion) VALUES
('limite_inasistencias', '3',  'Número máximo de inasistencias consecutivas antes del bloqueo automático'),
('dias_suspension',      '15', 'Días de suspensión al superar el límite de inasistencias');

-- =================================================================
-- FIN DEL SCRIPT
--
-- Usuarios de prueba (contraseña: admin123):
--   admin@carenest.pe     → ADMIN
--   admision@carenest.pe  → ADMISION
--   juan@gmail.com        → PACIENTE
--
-- Nota: los horarios se crean automáticamente al reservar (Enfoque A1).
--       La tabla horarios y citas comienzan vacías.
-- =================================================================
