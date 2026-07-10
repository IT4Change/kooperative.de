# Kooperative-Shop v0.5.0 — Release Notes

Dieser Release ist der größte Schritt seit dem Projektstart: **Bestellungen gehen ab jetzt direkt in die bestehende Shop-Datenbank**. Damit ist der neue Shop nicht mehr nur Schaufenster, sondern voll funktionsfähig parallel zum alten.

## Für die Kunden

**Bestellprozess komplett neu**

- Statt eines anonymen Bestellformulars durchläuft der Kunde jetzt einen sauberen Ablauf: Bestellliste → Anmelden oder Konto anlegen → Versand- und Zahlungsart wählen → Übersicht → Absenden.
- **Login mit Bestandskonto** funktioniert. Kunden, die im alten Shop registriert sind, können sich mit gleicher E-Mail und gleichem Passwort anmelden — die Daten sind kompatibel.
- **Neukunden** legen direkt im Shop ein Konto an (Anrede, Name, Geburtsdatum, Adresse, Telefon, E-Mail, Passwort).
- **Passwort vergessen** funktioniert über den alten Shop (Link führt direkt dorthin).

**Versand- und Zahlungsoptionen wie im alten Shop**

- 5 Versandarten: DPD (7,50 €), DHL (12,00 €), Express, Direktzustellung, Abholung — letzte drei nach Aufwand
- 3 Zahlungsarten: Vorkasse, Rechnung, Lastschriftverfahren IBAN (DE)
- Bei Lastschrift: IBAN wird live geprüft (Mod-97), und der Bankname wird automatisch unter dem Eingabefeld angezeigt — so erkennt man sofort, ob man sich vertippt hat. Quelle: offizielle Bundesbank-Liste, deckt 99,7 % der Banken ab.

**Rechtsverbindlichkeit klar kommuniziert**

- Drei Stellen weisen jetzt explizit darauf hin, dass der Kauf erst durch die Rück-Mail des Kunden zustande kommt — im Hilfe-Popup, in der Bestellübersicht und nach dem Absenden.

**Kleinere Verbesserungen**

- "Warenkorb" heißt jetzt durchgängig "Bestellliste"
- Cookie-Hinweis erscheint korrekt vor dem ersten Speicherzugriff
- Bücher-Kategorie sortiert nach Neuheit (jüngste Aufnahme zuerst); andere Kategorien weiter nach Beliebtheit

## Für den Operator

**Bestellungen landen sauber in der bestehenden Datenbank**

Der neue Shop schreibt in dieselben Tabellen wie der alte: `orders`, `orders_products`, `orders_total`, `orders_status_history`, `customers`, `address_book`, `customers_info` und bei Lastschrift in `banktransfer_iban`. Format und Werte sind 1:1 wie der alte Shop — die gewohnten Admin-Tools funktionieren ohne Anpassung.

**Bestell-E-Mail an `vertrieb@kooperative.de`**

Pro Bestellung kommt eine strukturierte Mail mit:

- Klarer Betreff-Markierung `[Koop · neuer Shop] Bestellung #…` (so kannst du neue von alten Bestellungen unterscheiden)
- Direkt-Link in den Alt-Shop-Admin auf die Bestellung
- Kunde, Lieferadresse, Positionstabelle (HTML), Versandart, Zahlungsart
- Bei Lastschrift: Kontoinhaber + IBAN für die Abbuchung
- Reply-To zeigt auf den Kunden — eine Antwort geht direkt zurück, nicht in den Mail-Pott

**Beliebtheits-Sortierung wird gepflegt**

Jeder Aufruf einer Produktdetail-Seite erhöht jetzt `products_viewed` (wie der alte Shop) — die Beliebtheits-Sortierung bleibt damit auch dauerhaft aussagekräftig.

## Sicherheits- und Übergabe-Maßnahmen

**Audit-Log aller Datenbank-Schreibvorgänge**

Jeder INSERT, UPDATE und DELETE wird in einer Tagesdatei protokolliert (`logs/db-writes-YYYY-MM-DD.jsonl`), inklusive Vorzustand. Sensible Felder (Passwörter, IBANs) werden maskiert. Damit ist im Nachgang nachvollziehbar, was der neue Shop in der DB verändert hat.

**Sicherheitsschalter `ALLOW_DB_WRITES`**

Standardmäßig kann der neue Shop nur lesen. Erst wenn die Schreibpfade reviewt sind und ein Backup gezogen wurde, schaltest du in der Konfiguration auf `true`. So kannst du ohne Risiko gegen Echtdaten testen.

**Übergabe-Dokumente**

- `docs/DB_WRITES.md` listet alle Schreibvorgänge mit Tabellen und Spalten — das ist die Datei, die vor jedem Stage-/Prod-Deploy geprüft werden sollte
- README beschreibt, wie ein sicheres Session-Secret erzeugt wird (`openssl rand -base64 48`)

## Was bewusst nicht gemacht wurde

- Kein Online-Payment — Zahlung wird wie bisher außerhalb des Shops abgewickelt
- Keine automatische Bestätigungs-Mail an den Kunden — die Bestellbestätigung läuft weiterhin manuell per Mail-Antwort des Operators (rechtlich gewollt)
- Keine Schemaänderungen am bestehenden DB-Schema — der alte Shop kann uneingeschränkt parallel weiterlaufen
