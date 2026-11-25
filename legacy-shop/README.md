# Patches für den Altshop (shop.kooperative.de)

Der alte osCommerce-Shop läuft parallel zum neuen weiter und teilt sich mit ihm
die Datenbank. Dieser Ordner enthält Erweiterungen für den Altshop, **ohne eine
seiner bestehenden Dateien zu ändern**.

## Wie es funktioniert

osCommerce lädt beim Start jeder Seite die Datei `includes/local/configure.php`,
sofern sie existiert (`includes/application_top.php`, Zeile 26 – eigentlich für
lokale Entwickler-Einstellungen gedacht). Im Auslieferungszustand gibt es sie
nicht. Unser Loader nutzt diesen Einstiegspunkt:

```
includes/local/configure.php          Loader
includes/local/patches/<seite>.php    übernimmt <Shop-Root>/<seite>.php
includes/local/filters/<name>.php     Ausgabefilter für jede Seite
includes/local/koop/                  gemeinsamer Code der Patches
```

- **Patch einschalten:** Datei nach `includes/local/patches/` kopieren.
- **Patch ausschalten:** Datei dort löschen – die Originalseite ist sofort zurück.
- **Alles ausschalten:** `includes/local/configure.php` löschen.

Ein Patch beendet die Anfrage immer selbst: Er führt `application_top.php` ein
zweites Mal vollständig aus (der erste Durchlauf wurde am Einstiegspunkt
unterbrochen) und gibt dann seine Seite aus. Das funktioniert, weil
`application_top.php` selbst keine Funktionen oder Klassen deklariert – der
Smoke-Test prüft das gegen die echte Datei.

`includes/.htaccess` des Shops sperrt den direkten Web-Zugriff auf alle
`.php`-Dateien unterhalb von `includes/`, also auch auf diese.

## Rechtstexte

| Patch             | zeigt                                                        |
| ----------------- | ------------------------------------------------------------ |
| `datenschutz.php` | Datenschutzerklärung                                         |
| `privacy.php`     | Datenschutzerklärung (osCommerce-Seite, bisher Platzhalter)  |
| `imprint.php`     | Impressum                                                    |
| `agb.php`         | AGB, danach Versand & Zahlung und Widerrufsbelehrung         |
| `conditions.php`  | wie `agb.php` (osCommerce-AGB-Seite, aus dem Checkout verlinkt) |
| `shipping.php`    | Versand & Zahlung                                            |

Die Texte kommen aus den Tabellen `koop_legal_text_live` und
`koop_legal_text_version` (Migration `database/migrations/005_koop_legal_text.sql`)
und werden im Admin des neuen Shops unter **Rechtstexte** gepflegt. Live
schalten wirkt in beiden Shops gleichzeitig.

Gibt die Datenbank keinen Live-Text her (Tabelle fehlt, keine Version aktiv,
Datenbankfehler), zeigt der Patch die unveränderte Originalseite – byte-genau,
der Test vergleicht das.

Das gespeicherte HTML ist reines ASCII (Umlaute usw. als numerische Entities).
Es erscheint daher im ISO-8859-1-Altshop korrekt, egal welchen Zeichensatz die
Datenbankverbindung verwendet.

## Vertrag widerrufen (§ 356a BGB)

`filters/withdrawal_link.php` setzt in den Footer **jeder** Seite direkt hinter
„Impressum“ einen Link „Vertrag widerrufen“. Er führt zur Widerrufsfunktion des
neuen Shops (`/vertrag-widerrufen`), die Erklärungen zu Bestellungen aus beiden
Shops annimmt – der Altshop bekommt kein eigenes Formular.

Technisch ist das ein Ausgabefilter (`ob_start`), den der Loader einmal pro
Anfrage lädt, also auch für gepatchte Seiten. Eine Seite ohne die
Impressum-Zelle (Popups, Weiterleitungen, Downloads) bleibt byte-genau
unverändert. Voraussetzung ist, dass die GZIP-Kompression des Shops aus ist
(`GZIP_COMPRESSION = false`, so ist es eingestellt) – sonst sähe der Filter
nur komprimierte Daten und ließe die Seite unverändert.

**Vor dem Kopieren** die Ziel-URL `KOOP_WITHDRAWAL_URL` oben in der Datei
prüfen (Default: Staging `https://neu.kooperative.de/vertrag-widerrufen`).
Link entfernen: Datei löschen.

## Installation

Per FTP ins Shop-Verzeichnis kopieren, Pfade 1:1:

```
legacy-shop/includes/local/configure.php  →  <shop>/includes/local/configure.php
legacy-shop/includes/local/koop/          →  <shop>/includes/local/koop/
legacy-shop/includes/local/patches/       →  <shop>/includes/local/patches/
legacy-shop/includes/local/filters/       →  <shop>/includes/local/filters/
```

Voraussetzung: Migration 005 ist eingespielt, und die Texte sind importiert
(siehe „Rechtstexte“ im Haupt-README). Solange das nicht passiert ist, zeigt der
Altshop einfach weiter seine Originalseiten.

## Test

```sh
legacy-shop/test/run.sh                         # Smoke-Test mit lokalem PHP ≥ 7
PHP5_IMAGE=php:5.5-cli legacy-shop/test/run.sh  # zusätzlich Syntax-Check unter PHP 5
```

Der Smoke-Test baut aus `test/fixture/` einen Mini-Shop. Er verwendet, sofern
vorhanden, die **echten** Originalseiten aus `old/ftp-data/shop/` (nicht im Git),
sonst Platzhalterseiten aus der Fixture (so läuft er in der CI,
`.github/workflows/legacy-shop.test.smoke.code.yml`). Er prüft:

- Patch aktiv: Der Text kommt aus der Datenbank.
- Kein Text oder Datenbankfehler: Die Originalseite erscheint byte-identisch.
- Patch entfernt: Die Originalseite ist zurück.
- Filter: Der Widerrufslink steht genau einmal hinter „Impressum“, auch auf
  gepatchten Seiten (und im echten Footer, wenn `old/` vorhanden ist); Seiten
  ohne Footer bleiben byte-identisch; Filter gelöscht → kein Link.

Der Code muss zu PHP 5.2 kompatibel bleiben: Der Altshop setzt
`register_globals` voraus, läuft also höchstens auf PHP 5.3. Ältere
PHP-Images als 5.5 lassen sich nicht mehr aus Docker Hub ziehen. Deshalb
verzichtet der Code bewusst auf alles, was nach 5.2 dazukam (Closures,
`[]`-Arrays, `?:`, `__DIR__`, Namespaces).
