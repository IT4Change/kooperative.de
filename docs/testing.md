# Tests & Linting

Alle Kommandos laufen in `app/`.

| Kommando | Was es tut |
| --- | --- |
| `npm run test:lint` | ESLint + Typecheck (das, was die CI als Gate fährt) |
| `npm run test:lint:eslint` | ESLint mit `--max-warnings 0` |
| `npm run test:lint:typecheck` | `vue-tsc --noEmit` |
| `npm run test:unit` | Vitest einmalig inkl. Coverage-Gate |
| `npm run test:unit:dev` | Vitest im Watch-Modus |
| `npm run test:e2e` | Playwright gegen echte DB + Mailserver (Stack muss laufen) |
| `npm run e2e:stack:up` / `:down` | Wegwerf-Backend starten/entfernen |
| `npm run e2e:seed` | DB manuell zurücksetzen (macht `test:e2e` selbst) |

Jedes Gate hat einen eigenen Workflow unter `.github/workflows/app.test.*.yml`,
jeweils mit vorgeschaltetem `paths-filter`-Job, damit Änderungen außerhalb von
`app/` keine Läufe auslösen.

## Linting

`eslint.config.ts` kombiniert die Flat-Config von `@nuxt/eslint` mit den Modulen
aus [`eslint-config-it4c`](https://www.npmjs.com/package/eslint-config-it4c).

Wichtig für spätere Änderungen: Aus den it4c-Modulen `eslint`, `typescript`,
`vue3` und `importX` werden **nur die Rules** übernommen — Plugin- und
Parser-Setup liefert Nuxt. Sonst registrieren beide Seiten dieselben Plugins
doppelt (und it4c nutzt `import-x/*`, Nuxt `import/*`, weshalb die Regelnamen
umgeschrieben werden). Die übrigen Module (`node`, `promise`, `security`,
`comments`, `json`, `yaml`, `vitest`, `prettier`) sind self-contained und werden
komplett gespreadet; `prettier` muss letzter Eintrag bleiben.

Typgestütztes Linting braucht `typescript.tsconfigPath` in der `nuxt.config.ts`.
Damit auch `eslint.config.ts`, `prettier.config.ts` und `vitest.config.ts`
aufgelöst werden, zieht `typescript.nodeTsConfig.include` sie ins Node-Projekt.

Prettier kommt über `prettier.config.ts` als Re-Export aus
`eslint-config-it4c/prettier` — keine projekteigenen Formatierungsregeln.

### Bewusst abgeschaltete Regeln

Jede Ausnahme steht mit Begründung in `eslint.config.ts`. Zwei davon sind
Altlasten und sollen zurückgeholt werden, sobald Tests sie absichern:

- `no-catch-all/no-catch-all` — 44 bestehende `catch`-Blöcke. Sie umzubauen ändert
  Laufzeitverhalten; das ist ohne Testabdeckung nicht verantwortbar.
- `n/no-process-env` unter `server/**` — `mailer`, `auth`, `adminAuth`, `dbWrite`
  lesen `process.env` direkt statt über `runtimeConfig`.

## Unit-Tests

Vitest läuft über `defineVitestConfig` aus `@nuxt/test-utils`. Specs liegen als
`*.spec.ts` neben der Quelle.

Server-Module nutzen Nitros Auto-Imports (`createError`, `getRequestURL`, …), die
es unter Vitest nicht gibt. Specs für solche Module setzen deshalb oben:

```ts
// @vitest-environment node
import '../../test/setup-server'
```

`test/setup-server.ts` installiert die h3-Helper als Globals.
`test/setup.ts` läuft für alle Specs und macht Vue-Warnings zu Testfehlern.

Die Suite läuft mit `TZ=UTC`, damit die Datumsformatierung deterministisch ist.

## Coverage-Ratchet

Die Schwellwerte in `vitest.config.ts` sind ein **Boden, der nur steigt**:

- Die globalen Werte sind aktuell niedrig, weil `all: true` sämtliche noch
  ungetesteten Vue-Seiten und API-Handler mitzählt. Sie verhindern, dass die
  Abdeckung insgesamt zurückfällt.
- Der Glob-Eintrag pinnt die Module der ersten Testwelle auf ~95–100 %, damit
  diese nicht verrotten, während die globale Zahl klettert.

**Vorgehen beim Erweitern:** Tests schreiben → `npm run test:unit` → die
erreichten Werte als neue Schwellen eintragen (globale Werte anheben, neu
abgedeckte Dateien in den Glob aufnehmen). Schwellen werden nie gesenkt; wenn ein
Wert fällt, fehlt ein Test.

### Abgedeckt (erste Welle)

`server/utils/`: `iban`, `blz`, `converter`, `validate`, `mailFooter`,
`orderStatus`, `checkoutOptions`, `countries`, `links` ·
`app/composables/useAdminFormat`

### Noch offen

Composables mit State (`useCart`, `useAuth`, `useConsent`, `useStorage`),
API-Handler mit gemocktem DB-Layer, `orderCompute`/`pendingOrder` (brauchen ein
Pool-Mock), Komponenten-Rendering.

## E2E-Tests (Full-Stack)

Playwright fährt die App gegen eine **echte MariaDB und einen echten Mailserver**.
Das ist der einzige Weg, den eigentlichen Risikopfad zu prüfen: Bestellung →
`koop_pending_order` → Bestätigungsmail → Token-Link → Materialisierung in den
osCommerce-Tabellen → Admin-Statuswechsel → Status-Mail.

```bash
cd app
npm run e2e:stack:up     # MariaDB (3307) + maildev (1026/1081)
npm run test:e2e
npm run e2e:stack:down   # -v, der Stack ist Wegwerfware
```

### Warum ein eigener Stack

`docker-compose.e2e.yml` ist bewusst getrennt von `docker-compose.yml`: eigener
Projektname, `tmpfs` statt Volume, und verschobene Ports (3307/1026/1081). So
kollidiert er weder mit dem Dev-Stack noch mit MariaDB/maildev anderer Projekte.
Die App läuft auf **3100**, nicht auf 3000.

### Woher die Datenbank kommt

Die Produktivdaten sind ein 33 MB großer osCommerce-Dump mit echten Kundendaten
(`old/`, nicht im Repo — und das bleibt so). Stattdessen gibt es zwei
committete, personendatenfreie Artefakte:

| Datei | Inhalt |
| --- | --- |
| `database/schema/oscommerce.sql` | DDL der 20 benutzten Tabellen, ohne Zeilen |
| `database/seed/reference.sql` | Lookup-Zeilen, deren IDs im Code hart stehen (`countries` 81/14/204, `tax_rates`, `orders_status`) |

Beide werden von `database/extract-schema.mjs` aus dem Dump erzeugt:

```bash
node database/extract-schema.mjs old/kooperative_db2.sql
```

`app/scripts/seed-e2e.mjs` setzt daraus vor jedem Lauf eine frische DB auf:
Schema neu anlegen → Referenzdaten → `koop_*`-Tabellen droppen und über den
echten `migrate.mjs` neu bauen → synthetische Fixtures. Das Skript **verweigert**
den Dienst gegen eine Datenbank mit mehr als 50 Bestellungen.

Beim Erweitern der Tabellenliste beide Zugriffsarten prüfen — Lesezugriffe stehen
als literales SQL im Code, Schreibzugriffe laufen über `dbInsert`/`dbUpdate` mit
dem Tabellennamen als Parameter. Genau daran fehlten anfangs `customers_info`
und `banktransfer_iban`.

### Fixtures

Ein Produkt pro Konvertierungsfall, sonst nichts: normaler MwSt-Satz (Honig,
19 % → 11,90), ermäßigter Satz (Brot, 7 % → 3,21), Größenvarianten (Olivenöl),
Mengenstaffel (Karte 1 Stk. / ab 10 Stk.), ein inaktives Produkt, ein
verschachtelter Kategoriebaum und ein Testkunde mit deutscher Adresse
(Steuerzone 2).

### Zwei Stolpersteine, die dokumentiert bleiben sollten

**Production-Build statt `nuxt dev`.** Der Dev-Server lädt Nuxt DevTools nach der
Hydration nach und rendert die Seite unter dem Test neu — das erzeugte
reproduzierbare Flakes. Playwright baut deshalb und startet `.output/server`.

**Hydration abwarten.** Seiten sind serverseitig gerendert; wer vor der Hydration
klickt oder tippt, löst nichts aus und sieht nur einen unveränderten Wert. Für
den Shop dient das „So funktioniert die Bestellung"-Modal als Signal: es wird aus
`onMounted` geöffnet, seine Sichtbarkeit ist also der Beweis, dass der Client
übernommen hat. Vue-Interna taugen nicht — `app._instance` fällt im
Production-Build weg.

Dazu passend: `e2e/helpers/api.ts` ruft die API per `fetch` **innerhalb der
Seite** auf. Das Session-Cookie ist im Production-Build `Secure`; Chromium
akzeptiert das auf `127.0.0.1`, Playwrights eigenständiger Request-Context nicht.

### Warum `/admin/api/**` den Accept-Header überschreibt

Nitro entscheidet über `isJsonRequest()`, ob ein Fehler als JSON oder als
gerenderte Nuxt-Fehlerseite rausgeht. Die Heuristik erkennt API-Routen unter
anderem an `event.path.startsWith('/api/')` — die Admin-Endpunkte liegen aber
absichtlich unter `/admin/api/`, damit sie sich den Basic-Auth-Realm mit den
Admin-Seiten teilen. Folge: Jeder Client mit `Accept: text/html` bekam bei einem
401 eine HTML-Fehlerseite statt JSON, und deren Rendering ließ den Vue-Router
einen Pfad auflösen, für den es keine Seite gibt → zwei
`[Vue Router warn] No match found` pro Request im Log, in Produktion bei jedem
Bot-Zugriff.

`server/middleware/admin-auth.ts` setzt für diese Pfade den Accept-Header auf
`application/json`, bevor irgendein Handler läuft. Das korrigiert Content-Type
und Log-Rauschen für *alle* Fehler auf dem Pfad, nicht nur für den 401. Zwei
E2E-Tests halten das fest (JSON für die API, weiterhin HTML für `/admin`).

### Selektoren

Die Suite greift ausschließlich über `data-testid` zu — Tailwind-Klassen und
deutsche UI-Texte sind als Selektoren zu brüchig. Die Hooks sind bewusst dünn
gesät (Produktkarte, Warenkorb, Login, Checkout-Schritte, Admin-Statusformular).
