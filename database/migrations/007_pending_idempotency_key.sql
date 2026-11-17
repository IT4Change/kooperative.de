-- Migration 007: Doppelt abgeschickte Bestellungen erkennen
--
-- Der Checkout schickt pro Bestellversuch einen zufälligen Schlüssel mit. Kommt
-- dieselbe Anfrage ein zweites Mal an (Doppelklick, Netz-Wiederholung, zweiter
-- Tab), findet der Server die erste Bestellung wieder, statt eine zweite
-- anzulegen. Eindeutig je Kunde; NULL für Bestellungen ohne Schlüssel
-- (Altbestand, alter Bestätigungsweg) -- mehrere NULL verletzen den Index nicht.
--
-- Portabel (MySQL & MariaDB): kein "IF NOT EXISTS" bei ALTER. Der Migrations-
-- Runner (app/scripts/migrate.mjs) führt jede Migration genau einmal aus und
-- toleriert "schon vorhanden"-Fehler (dup column/index) idempotent.

ALTER TABLE `koop_pending_order` ADD COLUMN `idempotency_key` CHAR(36) NULL AFTER `token`;
ALTER TABLE `koop_pending_order` ADD UNIQUE KEY `uq_customer_idempotency` (`customers_id`, `idempotency_key`);
