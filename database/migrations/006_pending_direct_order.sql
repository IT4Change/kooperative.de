-- Migration 006: Direktbestellung ohne Bestätigungsschritt
--
-- Der neue Shop ist ein normaler Shop geworden: "Zahlungspflichtig bestellen"
-- ist das verbindliche Angebot, eine Bestätigung per Link oder Antwort entfällt.
-- Die Bestellung wird beim Absenden sofort in osCommerce angelegt (Status 1).
--
-- koop_pending_order bleibt trotzdem der Datensatz jeder Neu-Shop-Bestellung:
-- er trägt das Token für den Link in der Kundenmail, die Herkunft "neuer Shop"
-- (orders_id verknüpft) und den gepinnten Preis-Snapshot. Er wird für eine
-- Direktbestellung in einem Zug angelegt und materialisiert, mit
-- confirmed_via = 'direct'. Alte, noch offene Bestellungen laufen über die
-- bisherigen Wege (link/reply/admin) aus.
--
-- MODIFY mit vollständiger Werteliste ist idempotent und portabel (MySQL & MariaDB).

ALTER TABLE `koop_pending_order`
  MODIFY `confirmed_via` ENUM('link','reply','admin','direct') NULL;
