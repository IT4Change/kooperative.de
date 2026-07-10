# Datenbank-Schreibpfade des neuen Shops

**Stand:** 2026-05-07 (Phase 1: Auth + Bestellung)

Diese Datei listet **alle** Tabellen und Spalten, in die der neue Nuxt-Shop schreibt.
Sie ist das Review-Dokument vor jedem Stage-/Prod-Deploy: Wenn hier nichts Neues
eingetragen wurde, schreibt der Shop auch nichts Neues.

Bei jeder Änderung an einem Schreibpfad **muss** dieses Dokument mit aktualisiert werden.

## Konventionen

- Alle Schreibvorgänge laufen über `app/server/utils/dbWrite.ts` (`dbInsert`, `dbUpdate`, `dbUpdateExpr`, `dbDelete`)
- Jeder Schreibvorgang wird in `logs/db-writes-YYYY-MM-DD.jsonl` protokolliert
  (sensible Felder maskiert, bei UPDATE/DELETE inkl. Vorher-Zustand)
- Schreibvorgänge sind hinter `ALLOW_DB_WRITES=true` gegated; in Stage default `false`

## Schreibpfade

### 1. Registrierung — `POST /api/auth/register`

Dateipfad: `app/server/api/auth/register.post.ts`

Schritt 1: **INSERT INTO `customers`**
```
customers_gender, customers_firstname, customers_lastname, customers_dob,
customers_email_address, customers_default_address_id (=0, in Schritt 3 gepatcht),
customers_telephone, customers_fax (=''), customers_password (md5+salt),
customers_newsletter (='0'), payment ('vorkasse'), rechnung (=0), versand ('gls_gls')
```

Schritt 2: **INSERT INTO `address_book`**
```
customers_id, entry_gender, entry_company (=''), entry_firstname, entry_lastname,
entry_street_address, entry_suburb (=''), entry_postcode, entry_city,
entry_state (=''), entry_country_id (DE/AT/CH → 81/14/204), entry_zone_id (=0)
```
Bei Fehler: **Kompensations-DELETE** der `customers`-Zeile aus Schritt 1.

Schritt 3: **UPDATE `customers` SET `customers_default_address_id` = (neue address_book_id) WHERE customers_id = …**

Schritt 4: **INSERT INTO `customers_info`**
```
customers_info_id (= customers_id), customers_info_number_of_logons (=0),
customers_info_date_account_created (=NOW), global_product_notifications (=0)
```

### 1b. Produktdetail-Aufruf — `POST /api/products/:id/view`

Dateipfad: `app/server/api/products/[id]/view.post.ts`

Wird vom Frontend einmalig pro Detail-Seitenaufruf in `pages/shop/[...path].vue`
gefeuert (best-effort, Fehler verschluckt).

**UPDATE `products_description` SET `products_viewed` = `products_viewed` + 1
WHERE `products_id` = :id AND `language_id` = 2** — exakt wie der Alt-Shop in
`product_info.php:103`. Kein Bot-Filter, keine Sessions-Deduplizierung — wir
spiegeln das Verhalten 1:1.

Dieser Counter treibt die globale Beliebtheits-Sortierung der Produktliste.

### 2. Login — `POST /api/auth/login`

Dateipfad: `app/server/api/auth/login.post.ts`

**UPDATE `customers_info` SET `customers_info_date_of_last_logon` = NOW(), `customers_info_number_of_logons` = COALESCE(…) + 1 WHERE customers_info_id = …**

(Best-effort: Fehler hier schlagen den Login nicht fehl.)

### 3. Bestellung absenden — `POST /api/orders`

Dateipfad: `app/server/api/orders.post.ts`

> **GEÄNDERT (Mail-Bestätigungs-Flow):** Beim Absenden werden die osCommerce-Tabellen
> **NICHT mehr** beschrieben. Stattdessen wird die berechnete Bestellung (Preise gepinnt)
> als **`koop_pending_order`** gespeichert (Status `pending`) und es gehen zwei Mails raus
> (Kunde: Bestätigungs-Anfrage mit Link/Reply; Admin: „unbestätigt eingegangen") — beide in
> `koop_order_mail_log`. Die unten beschriebenen osCommerce-INSERTs passieren erst bei der
> **Bestätigung** (Materialisierung), siehe Abschnitt 3b. Berechnung/Insert liegen in
> `app/server/utils/orderCompute.ts` (`computeOrder` / `insertComputedOrder`).

Bei der Materialisierung (Abschnitt 3b) in Reihenfolge:

**INSERT INTO `orders`** — Header inkl. Kunden-, Liefer- und Rechnungsadresse (in Phase 1
identisch befüllt). Statische Werte: `currency = 'EUR'`, `currency_value = 1.0`,
`orders_status = 1` (= "In Bearbeitung"), `*_address_format_id = 5`,
`payment_method` aus der Auswahl des Kunden (`"Bezahlung mit Vorkasse"` oder
`"Bezahlung mit Rechnung"`, identisch zum Alt-Shop). Adresse stammt aus dem
`address_book`-Eintrag des Kunden.

**INSERT INTO `orders_products`** (eine Zeile pro Position):
`orders_id, products_id, products_model, products_name, products_price (Netto),
final_price (Brutto pro Stk.), products_tax (%), products_quantity`.

**INSERT INTO `orders_total`** (vier Zeilen, exakt wie Alt-Shop-Modulkette
`ot_subtotal.php; ot_shipping.php; ot_tax.php; ot_total.php`):
1. **Zwischensumme** (`class='ot_subtotal'`, `sort_order=1`,
   `title='Zwischensumme:'`, `text='X,XX&nbsp;EURO'`) — Brutto-Summe der Positionen
2. **Versand** (`class='ot_shipping'`, `sort_order=2`,
   `title=` z.B. `'Versand mit DPD:'`/`'Versand mit DHL:'`/`'Direktzustellung:'`,
   `text='X,XX&nbsp;EURO'`, bei "nach Aufwand"-Optionen `value=0`)
3. **Steuer** (`class='ot_tax'`, `sort_order=3`, eine Zeile pro distinct
   `tax_description` aus `tax_rates`, gefiltert nach Kundenzone — z.B.
   `title='Mehrwertsteuer:'`, oder `'Mehrwertsteuer ermäszigt:'`, oder
   `'Mehrwertsteuer - Ausland:'`. Wert = bereits in Brutto enthaltener
   Steueranteil aus Positionen + ggf. Versand)
4. **Gesamtsumme** (`class='ot_total'`, `sort_order=4`,
   `title='<b>Summe</b>:'`, `text='<b>X,XX&nbsp;EURO</b>'`)

Format-Strings (Komma-Dezimal, `&nbsp;EURO`, `<b>`-Tags) entsprechen dem Alt-Shop.

**Versand-Optionen** (Werte fest; Mapping siehe `app/server/utils/checkoutOptions.ts`):

| Code | Modul | Beschreibung | Netto € | Tax-Klasse |
|---|---|---|---|---|
| `dpd` | Versand mit DPD | innerhalb Deutschlands | 6,3025 | 2 (19%) |
| `dhl` | Versand mit DHL | innerhalb Deutschlands (Standard) | 10,0840 | 2 (19%) |
| `express` | Versand mit Express | nach Aufwand | 0 | 0 (kein) |
| `direkt` | Direktzustellung | nach Vereinbarung | 0 | 0 (kein) |
| `abholung` | Abholung | nur nach Absprache | 0 | 0 (kein) |

**Steuerberechnung:** Pro Position wird nach Land (DE→geo_zone 2, AT→3,
CH→ohne Zone) die zugehörige Tax-Rate aus `tax_rates` selektiert. Der ausgewiesene
Steuerbetrag pro Tax-Description ist die **bereits im Bruttopreis enthaltene**
Steuer (`value = gross − gross/(1+rate/100)`), summiert über Positionen + Versand.

**INSERT INTO `orders_status_history`**:
`orders_id, orders_status_id (=1), date_added (=NOW), customer_notified (=0),
comments (Anmerkungen aus dem Formular)`.

**UPDATE `products` SET `products_ordered` = `products_ordered` + N WHERE `products_id` = …**
(eine Anweisung pro Position; Fehler werden geloggt, aber blockieren die Bestellung nicht).

**Nur bei `paymentMethod = 'lastschrift'`:**

**INSERT INTO `banktransfer_iban`** mit den Bankdaten des Kunden für diese
Bestellung (`orders_id`, `banktransfer_owner`, `banktransfer_number` = IBAN,
`banktransfer_bankname` = leer, `banktransfer_status = 0`, `banktransfer_prz = '00'`,
`banktransfer_fax = NULL`).

**UPDATE `customers`** mit den IBAN-Feldern (`customers_banktransfer_iban_owner`,
`customers_banktransfer_iban_number`, `customers_banktransfer_iban_bankname`),
damit der Alt-Shop bei einem späteren Login den Eintrag im IBAN-Formular vorausfüllt.

> Bankdaten (Owner, IBAN, BLZ, Bankname) sind in `dbWriteLog` als sensible
> Felder maskiert. In der Operator-Mail werden sie unmaskiert übermittelt,
> da der Operator den Lastschrift-Auftrag damit erteilt.

> `products_quantity` wird **nicht** dekrementiert — der Alt-Shop nutzt das Feld de
> facto nicht (`STOCK_CHECK = false`, `STOCK_LIMITED = false`). 100% Verhaltens-Kompat
> wäre hier rein kosmetisch.

### 3a. Pending-Bestellung anlegen — `POST /api/orders`

**INSERT INTO `koop_pending_order`** (`token, customers_id, email, payload` (JSON:
`{input, comp}` mit gepinnter Berechnung), `total`, `status='pending'`, `created_at`).
Plus 2× **INSERT INTO `koop_order_mail_log`** (`order_confirmation_request` an Kunde,
`admin_new_pending` an Betreiber). Keine osCommerce-Writes.

### 3b. Bestellung bestätigen / materialisieren

Dateien: `app/server/api/orders/confirm.post.ts` (Kunde via Link),
`app/server/routes/admin/api/pending/[id]/confirm.post.ts` (Betreiber manuell, z.B. nach
Reply). Beide rufen `confirmPending` → `materializePending` → `insertComputedOrder`.

- Die osCommerce-INSERTs aus Abschnitt 3 (`orders`, `orders_products`, `orders_total`,
  ggf. `banktransfer_iban`/`customers`, `orders_status_history`, `products.products_ordered`)
  laufen **hier** — exakt wie zuvor beim Direkt-Checkout.
- **UPDATE `koop_pending_order`** SET `status='materialized'`, `orders_id`, `confirmed_via`,
  `confirmed_at`, `materialized_at`. **Idempotent** (zweite Bestätigung legt nichts erneut an).
- 2× **INSERT INTO `koop_order_mail_log`** (`order_confirmed` an Kunde, `admin_order_confirmed`
  an Betreiber).
- Storno: `POST /admin/api/pending/:id/cancel` → **UPDATE `koop_pending_order`** SET
  `status='cancelled'` (nie materialisiert, kein osCommerce-Write).

### 4. Admin: Bestellabwicklung (State-Machine) — `POST /admin/api/orders/:id/status`

Dateipfad: `app/server/routes/admin/api/orders/[id]/status.post.ts`
(gesamter `/admin`-Bereich per HTTP-Basic-Auth geschützt, siehe `server/middleware/admin-auth.ts`)

Setzt eine Bestellung frei bedienbar auf einen anderen Status — exakt wie der
Alt-Admin (`admin/orders.php`):

**UPDATE `orders` SET `orders_status` = :statusId, `last_modified` = NOW() WHERE `orders_id` = :id**

**INSERT INTO `orders_status_history`**:
`orders_id, orders_status_id, date_added (=NOW), customer_notified (=0/1 je nach
Häkchen), comments (Operator-Kommentar)`.

**Nur bei „Kunde benachrichtigen":** zusätzlich Kundenmail (Status-Meldung,
`From: shop@kooperative.de`, `Reply-To:` Betreiber) + **INSERT INTO
`koop_order_mail_log`** (siehe unten).

### 4b. Admin: Benachrichtigung (erneut) senden — `POST /admin/api/orders/:id/notify`

Dateipfad: `app/server/routes/admin/api/orders/[id]/notify.post.ts`

Sendet dem Kunden die Mail zum **aktuellen** Status, **ohne** Statuswechsel.
Kein Write in `orders`/`orders_status_history`; nur **INSERT INTO
`koop_order_mail_log`** (`mail_type = 'status_notification_resend'`).

### 4c. Mail-Log — `koop_order_mail_log` (neu, additiv)

Zentral über `app/server/utils/orderMailLog.ts` (`sendAndLogOrderMail`). Jede zu
einer Bestellung versendete Mail (an Kunde ODER Administration) wird protokolliert:
`orders_id, direction, recipient, mail_type, related_status_id, subject,
body_text, body_html, status (sent/failed), error_message, sent_by (Operator),
created_at`. Sichtbar im Admin als Mail-Timeline der Bestellung.

> `body_text`/`body_html` enthalten Kunden-PII (Name/Adresse) und landen dadurch
> auch im `dbWriteLog`-JSONL. Kein Passwort/keine IBAN darin.

## NICHT geschriebene Tabellen

Phase 1 schreibt **nicht** in:
- `sessions` (eigene Cookie-Sessions, kein PHP-Session-State)
- `customers_basket`, `customers_basket_attributes` (Cart liegt im localStorage)
- `products_to_categories`, `products_description`, `products` (außer `products_ordered`)
- `orders_products_attributes`, `orders_products_download` (Produkte ohne Optionen/Downloads)
- `categories`, `categories_description`, `tax_rates`, `countries`, `zones`,
  `configuration` (Stammdaten, nur lesend)

## Sensible Felder (Maskierung im Audit-Log)

```
customers_password
customers_banktransfer_iban_owner / iban_number / iban_bankname
customers_banktransfer_owner / number / bankname / blz
banktransfer_owner / number / bankname / blz
```

Zusätzlich: **IBAN-Muster (DE/AT/CH) werden in JEDEM geloggten String redigiert**
(`***IBAN***`) — so ist die IBAN auch im `koop_pending_order.payload`-JSON nicht im
Klartext im Audit. Nach der Materialisierung wird die IBAN aus dem gespeicherten
`payload` entfernt (Scrub); sie lebt dann nur noch in `banktransfer_iban` (dort maskiert).
Während des Pending-Fensters steht die IBAN im `payload` der DB (nötig zur Materialisierung).

## Schema-Änderungen

**An bestehenden osCommerce-Tabellen: weiterhin keine.** ALTER / DROP an den
Alt-Shop-Tabellen bleiben verboten, solange der Alt-Shop parallel läuft.

**Additive Neu-Tabellen mit `koop_`-Prefix sind erlaubt** (der Alt-Shop ignoriert
unbekannte Tabellen). Migrationen unter `database/migrations/`, idempotent
(`CREATE TABLE IF NOT EXISTS`), vor Deploy auf der Live-DB auszuführen:

- `001_koop_order_mail_log.sql` — Mail-Log pro Bestellung (Admin-Timeline).
- `002_koop_pending_order.sql` — unbestätigte Bestellungen („Bestätigung ausstehend").
- `003_mail_log_pending.sql` — `koop_order_mail_log.orders_id` nullbar +
  `pending_order_id` (Mails vor Materialisierung).

**„Bestätigung ausstehend" ist via „Materialize-on-confirm" umgesetzt:** Der Status
existiert nur in `koop_pending_order`, NICHT als Zeile in der geteilten `orders_status`.
Erst bei Bestätigung wird die Bestellung als normale Status-1-Bestellung in `orders`
materialisiert. Die alte DB wird vom Konzept nicht berührt.
