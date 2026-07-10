-- Migration 002: Unbestätigte Neu-Shop-Bestellungen ("Bestätigung ausstehend")
--
-- Der Bestätigungs-Zustand lebt AUSSERHALB der osCommerce-Tabellen. Eine
-- Bestellung wird beim Absenden nur hier gespeichert (JSON-Snapshot inkl. der
-- fest gepinnten Preisberechnung). Erst nach Bestätigung (Link/Reply/Admin)
-- wird sie in die osCommerce orders-Tabellen "materialisiert" (Status 1) und
-- orders_id hier verknüpft. Die alte DB bleibt vom Konzept unberührt.

CREATE TABLE IF NOT EXISTS `koop_pending_order` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token`           CHAR(64) NOT NULL,
  `customers_id`    INT NOT NULL,
  `email`           VARCHAR(255) NOT NULL,
  `payload`         MEDIUMTEXT NOT NULL,
  `total`           DECIMAL(10,2) NOT NULL DEFAULT 0,
  `status`          ENUM('pending','confirmed','materialized','cancelled') NOT NULL DEFAULT 'pending',
  `orders_id`       INT NULL,
  `confirmed_via`   ENUM('link','reply','admin') NULL,
  `created_at`      DATETIME NOT NULL,
  `confirmed_at`    DATETIME NULL,
  `materialized_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token` (`token`),
  KEY `idx_status` (`status`),
  KEY `idx_orders_id` (`orders_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
