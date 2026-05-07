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

### 2. Login — `POST /api/auth/login`

Dateipfad: `app/server/api/auth/login.post.ts`

**UPDATE `customers_info` SET `customers_info_date_of_last_logon` = NOW(), `customers_info_number_of_logons` = COALESCE(…) + 1 WHERE customers_info_id = …**

(Best-effort: Fehler hier schlagen den Login nicht fehl.)

### 3. Bestellung absenden — `POST /api/orders`

Dateipfad: `app/server/api/orders/create.post.ts`

Erfordert eingeloggte Session. In Reihenfolge:

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

> `products_quantity` wird **nicht** dekrementiert — der Alt-Shop nutzt das Feld de
> facto nicht (`STOCK_CHECK = false`, `STOCK_LIMITED = false`). 100% Verhaltens-Kompat
> wäre hier rein kosmetisch.

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
```

## Schema-Änderungen

**Phase 1: Keine.** ALTER TABLE / CREATE TABLE / DROP * sind verboten, solange
der Alt-Shop parallel läuft. Eigene Felder werden später in einer separaten DB
hinzugefügt.
