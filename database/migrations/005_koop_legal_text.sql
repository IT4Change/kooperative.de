-- Migration 005: Rechtstexte (Impressum, Datenschutz, AGB, Widerruf, Versand & Zahlung)
--
-- Gemeinsame Quelle für den neuen Shop UND den Altshop (dort über die Patches in
-- legacy-shop/ eingebunden). Versionen sind unveränderlich: jede Bearbeitung im
-- Admin legt eine neue Zeile an. Welche Version live ist, steht ausschließlich in
-- koop_legal_text_live (ein Zeiger pro Seite) — Live-Schalten und Zurückrollen
-- ist damit ein einziges atomares UPDATE.
--
-- body_html ist das serverseitig aus body_md erzeugte, sichere HTML, in dem jedes
-- Nicht-ASCII-Zeichen als numerische Entity steht. Dadurch ist der Inhalt rein
-- ASCII und kommt unabhängig vom Verbindungs-Zeichensatz unverfälscht im
-- ISO-8859-1-Altshop an.
--
-- Inhalte enthält die Migration bewusst nicht: Die Texte liegen nicht im
-- Repository und werden mit app/scripts/legal-import.mjs über die Admin-API
-- importiert.

CREATE TABLE IF NOT EXISTS `koop_legal_text_version` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`        VARCHAR(32) NOT NULL,
  `version_no`  INT UNSIGNED NOT NULL,
  `body_md`     MEDIUMTEXT NOT NULL,
  `body_html`   MEDIUMTEXT NOT NULL,
  `note`        VARCHAR(500) NOT NULL DEFAULT '',
  `created_by`  VARCHAR(64) NOT NULL,
  `created_at`  DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slug_version` (`slug`, `version_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `koop_legal_text_live` (
  `slug`          VARCHAR(32) NOT NULL,
  `version_id`    INT UNSIGNED NOT NULL,
  `activated_by`  VARCHAR(64) NOT NULL,
  `activated_at`  DATETIME NOT NULL,
  PRIMARY KEY (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Protokoll jeder Live-Schaltung: welche Fassung galt wann. Für AGB und
-- Widerrufsbelehrung relevant, um später nachweisen zu können, welcher Text bei
-- einer bestimmten Bestellung galt.
CREATE TABLE IF NOT EXISTS `koop_legal_text_activation` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug`          VARCHAR(32) NOT NULL,
  `version_id`    INT UNSIGNED NOT NULL,
  `activated_by`  VARCHAR(64) NOT NULL,
  `activated_at`  DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_slug_time` (`slug`, `activated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
