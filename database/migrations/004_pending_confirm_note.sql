-- Migration 004: Begründung der manuellen Freischaltung
--
-- Gibt der Betreiberin die Bestellung ohne Kundenbestätigung frei (Schritt 1 im
-- neuen Shop), muss sie begründen, warum -- z.B. "telefonisch bestätigt am
-- 14.09." oder "Kunde hat per Fax geantwortet". Die Begründung gehört zum
-- Bestätigungsvorgang, nicht zur Bestellung, und lebt deshalb hier; zusätzlich
-- wird sie beim Materialisieren in orders_status_history.comments gespiegelt,
-- damit der alte osCommerce-Admin sie ebenfalls anzeigt.
--
-- TEXT statt VARCHAR: das Eingabefeld ist bewusst mehrzeilig, die Länge der
-- Begründung soll die Betreiberin nicht beschäftigen.
--
-- Portabel (MySQL & MariaDB): kein "IF NOT EXISTS" bei ALTER. Der Migrations-
-- Runner (app/scripts/migrate.mjs) führt jede Migration genau einmal aus und
-- toleriert "schon vorhanden"-Fehler (dup column/index) idempotent.

ALTER TABLE `koop_pending_order` ADD COLUMN `confirm_note` TEXT NULL AFTER `confirmed_via`;
