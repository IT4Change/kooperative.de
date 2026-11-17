-- Migration 008: Widerrufe über die Widerrufsfunktion (§ 356a BGB)
--
-- Jede über „Vertrag widerrufen“ abgegebene Erklärung, so wie die Kundin sie
-- abgeschickt hat. Gilt für Bestellungen aus beiden Shops (der Altshop verlinkt
-- auf dasselbe Formular). Passen Bestellnummer und E-Mail-Adresse zu einer
-- Bestellung, wird sie hier verknüpft (orders_id, customers_id); sonst bleibt die
-- Zuordnung der Verwaltung überlassen. Keine IP-Adresse: Die Erklärung ist durch
-- Inhalt, Zeitpunkt und Eingangsbestätigung belegt.

CREATE TABLE IF NOT EXISTS `koop_withdrawal` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(200) NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `order_ref`     VARCHAR(64) NOT NULL,
  `scope`         ENUM('all','partial') NOT NULL DEFAULT 'all',
  `items`         TEXT NULL,
  `message`       TEXT NULL,
  `orders_id`     INT NULL,
  `customers_id`  INT NULL,
  `created_at`    DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_orders_id` (`orders_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
