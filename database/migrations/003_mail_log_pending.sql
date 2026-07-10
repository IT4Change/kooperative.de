-- Migration 003: Mail-Log auch für unbestätigte Bestellungen (vor Materialisierung)
--
-- orders_id wird nullbar (Pending-Mails haben noch keine osCommerce-Bestellung);
-- pending_order_id verknüpft solche Mails mit koop_pending_order.
-- MariaDB 10.5+/11 unterstützt IF NOT EXISTS für ALTER — idempotent.

ALTER TABLE `koop_order_mail_log` MODIFY COLUMN `orders_id` INT NULL;
ALTER TABLE `koop_order_mail_log` ADD COLUMN IF NOT EXISTS `pending_order_id` INT NULL AFTER `orders_id`;
ALTER TABLE `koop_order_mail_log` ADD INDEX IF NOT EXISTS `idx_pending_order_id` (`pending_order_id`);
