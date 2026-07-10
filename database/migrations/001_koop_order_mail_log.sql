-- Migration 001: Mail-Log für Bestellungen (neuer Shop / Admin)
--
-- Additive, mit koop_-Prefix, damit der parallel laufende osCommerce-Alt-Shop
-- die Tabelle ignoriert. Protokolliert JEDE zu einer Bestellung versendete Mail
-- (an Kunde UND an Administration), damit der Bearbeiter im Admin die komplette
-- Mail-Historie einer Bestellung sieht.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Auf der Live-DB vor Deploy ausführen.

CREATE TABLE IF NOT EXISTS `koop_order_mail_log` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `orders_id`         INT NOT NULL,
  `direction`         ENUM('to_customer','to_admin') NOT NULL,
  `recipient`         VARCHAR(255) NOT NULL,
  `mail_type`         VARCHAR(64) NOT NULL,
  `related_status_id` INT NULL,
  `subject`           VARCHAR(512) NOT NULL,
  `body_text`         MEDIUMTEXT NULL,
  `body_html`         MEDIUMTEXT NULL,
  `status`            ENUM('sent','failed') NOT NULL DEFAULT 'sent',
  `error_message`     VARCHAR(512) NULL,
  `sent_by`           VARCHAR(128) NULL,
  `created_at`        DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_orders_id` (`orders_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
