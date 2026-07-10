-- Migration 003: Mail-Log auch für unbestätigte Bestellungen (vor Materialisierung)
--
-- orders_id wird nullbar (Pending-Mails haben noch keine osCommerce-Bestellung);
-- pending_order_id verknüpft solche Mails mit koop_pending_order.
--
-- Portabel (MySQL & MariaDB): kein "IF NOT EXISTS" bei ALTER. Der Migrations-
-- Runner (app/scripts/migrate.mjs) führt jede Migration genau einmal aus und
-- toleriert "schon vorhanden"-Fehler (dup column/index) idempotent.

ALTER TABLE `koop_order_mail_log` MODIFY COLUMN `orders_id` INT NULL;
ALTER TABLE `koop_order_mail_log` ADD COLUMN `pending_order_id` INT NULL AFTER `orders_id`;
ALTER TABLE `koop_order_mail_log` ADD INDEX `idx_pending_order_id` (`pending_order_id`);
