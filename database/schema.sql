-- ============================================================
-- Mi Agenda Digital - Esquema de base de datos
-- Compatible con MySQL 5.7+ / MariaDB 10.4+ (XAMPP)
--
-- Uso:
--   1. Abre phpMyAdmin > pestaña "SQL" (o usa la consola mysql).
--   2. Pega y ejecuta este script completo.
--
-- Crea la base de datos 'gestor_tareas' y las 4 tablas que usa
-- la aplicación. No incluye datos: registra tu usuario desde
-- index.php?accion=registro.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `gestor_tareas`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `gestor_tareas`;

-- ------------------------------------------------------------
-- Usuarios
-- 'tema' guarda la paleta de colores elegida (por defecto 'indigo')
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`              INT(11)      NOT NULL AUTO_INCREMENT,
  `nombre_usuario`  VARCHAR(50)  NOT NULL,
  `correo`          VARCHAR(255) NOT NULL,
  `password_hash`   VARCHAR(255) NOT NULL,
  `fecha_registro`  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `tema`            VARCHAR(20)  NOT NULL DEFAULT 'indigo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre_usuario` (`nombre_usuario`),
  UNIQUE KEY `correo` (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tareas (cada una pertenece a un usuario)
-- prioridad: Baja | Media | Alta
-- estado:    Pendiente | En progreso | Completada | Cancelada
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tareas` (
  `id`            INT(11)      NOT NULL AUTO_INCREMENT,
  `titulo`        VARCHAR(255) NOT NULL,
  `descripcion`   TEXT         DEFAULT NULL,
  `prioridad`     VARCHAR(10)  NOT NULL,
  `fecha_limite`  DATE         NOT NULL,
  `estado`        VARCHAR(20)  NOT NULL DEFAULT 'Pendiente',
  `usuario_id`    INT(11)      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_tareas_usuario` (`usuario_id`),
  CONSTRAINT `fk_tareas_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Actividades (eventos con fecha y horario)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `actividades` (
  `id`           INT(11)      NOT NULL AUTO_INCREMENT,
  `titulo`       VARCHAR(255) NOT NULL,
  `descripcion`  TEXT         DEFAULT NULL,
  `fecha`        DATE         NOT NULL,
  `hora_inicio`  TIME         NOT NULL,
  `hora_fin`     TIME         NOT NULL,
  `lugar`        VARCHAR(255) DEFAULT NULL,
  `usuario_id`   INT(11)      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_actividades_usuario` (`usuario_id`),
  CONSTRAINT `fk_actividades_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tokens de "Recordarme" (se guarda solo el hash del token)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tokens_recordar` (
  `id`          INT(11)      NOT NULL AUTO_INCREMENT,
  `usuario_id`  INT(11)      NOT NULL,
  `token_hash`  VARCHAR(255) NOT NULL,
  `expira_en`   DATETIME     NOT NULL,
  `creado_en`   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `tokens_recordar_ibfk_1`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;