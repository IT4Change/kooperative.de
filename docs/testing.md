# Tests & Linting

Alle Kommandos laufen in `app/`.

| Kommando | Was es tut |
| --- | --- |
| `npm run test:build` | Produktions-Build; jede Warnung ist ein Fehler |
| `npm run test:smoke` | Startet `nuxt dev`, holt `/`, jede Warnung ist ein Fehler |
| `npm run test:lint` | ESLint + Typecheck (das, was die CI als Gate fährt) |
| `npm run test:lint:eslint` | ESLint mit `--max-warnings 0` |
| `npm run test:lint:typecheck` | `vue-tsc --noEmit` |
| `npm run test:unit` | Vitest einmalig inkl. Coverage-Gate |
| `npm run test:unit:dev` | Vitest im Watch-Modus |
| `npm run test:e2e` | Playwright gegen echte DB + Mailserver (Stack muss laufen) |
| `npm run test:e2e:a11y:update` | axe-Baseline neu schreiben (nur nach beabsichtigter Änderung) |
| `npm run e2e:stack:up` / `:down` | Wegwerf-Backend starten/entfernen |
| `npm run e2e:seed` | DB manuell zurücksetzen (macht `test:e2e` selbst) |

Jedes Gate hat einen eigenen Workflow unter `.github/workflows/app.test.*.yml`,
jeweils mit vorgeschaltetem `paths-filter`-Job, damit Änderungen außerhalb von
`app/` keine Läufe auslösen.

## Warum es ein Build- *und* ein Smoke-Gate gibt

Lint, Typecheck und die Unit-Suite fassen drei Dinge nie an: Nitros Scan über
`server/`, die Auto-Import-Registry und den Vue-Compiler über alle Seiten. Genau
dort liegt eine eigene Fehlerklasse — eine Spec-Datei, die als Server-Plugin
eingesammelt wird; zwei Module, die denselben Auto-Import exportieren.

Die beiden Pipelines sind sich dabei nicht einig, und das ist der Grund für zwei
Schritte statt einem: Ein Spec unter `server/plugins/` lässt `nuxt dev` mit einem
Rollup-Fehler abbrechen, während `nuxt build` ihn stillschweigend wegoptimiert
und ein lauffähiges Artefakt abliefert. Ein Build-Gate allein hätte den Fall also
durchgelassen — nachgemessen, nicht vermutet.

Beide Skripte behandeln **jede Warnung als Fehler**, weil Nuxt Warnungen meldet
und trotzdem mit 0 aussteigt. Ausnahmen kommen in die `ACCEPTED`-Liste im
jeweiligen Skript, mit Begründung — und besser gar nicht.

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

Specs liegen damit auch innerhalb der Verzeichnisse, die Nitro scannt. Deshalb
steht in der `nuxt.config.ts` ein `ignore: ['**/*.spec.ts']` — ohne das wird
`server/plugins/*.spec.ts` als Plugin registriert (und bricht den Build mangels
Default-Export), `server/middleware/*.spec.ts` liefe bei jedem Request mit, und
jeder Spec unter `server/api/` würde ein Endpunkt.

Server-Module nutzen Nitros Auto-Imports (`createError`, `getRequestURL`, …), die
es unter Vitest nicht gibt. Specs für solche Module setzen deshalb oben:

```ts
// @vitest-environment node
import '../../test/setup-server'
```

`test/setup-server.ts` installiert die h3-Helper als Globals.
`test/setup.ts` läuft für alle Specs und macht Vue-Warnings zu Testfehlern.

Die Suite läuft mit `TZ=UTC`, damit die Datumsformatierung deterministisch ist.

### Komponenten und Seiten

Komponenten- und Seiten-Specs mounten über `mountSuspended` aus
`@nuxt/test-utils/runtime`; die Route setzt die Option `route`, z. B.
`mountSuspended(Page, { route: '/shop?kategorie=alle' })`.

HTTP beantwortet `registerEndpoint()` über einen echten h3-Server im Testprozess
— kein `$fetch`-Mock. Drei Fallstricke:

- `test/setup.ts` darf `globalThis.$fetch` nur setzen, wenn noch keins da ist.
  Überschreibt es das von Nuxt installierte, laufen die Endpunkte ins Leere.
- Die Methode wird gegen `event.method` verglichen, also **`method: 'POST'`**,
  nicht `'post'`.
- `getQuery`/`readBody` sind Nitro-Auto-Imports und in App-Specs nicht im Scope.
  Query aus `event.path` parsen, `readBody` direkt aus `h3` importieren.

`useFetch` cacht seinen Payload pro Key über die ganze Datei — Specs, die
mehrfach mit unterschiedlichen Antworten mounten, brauchen `clearNuxtData()` im
`beforeEach`. Wer nach `<body>` teleportiert (Dialoge), unmountet im `afterEach`,
sonst steht der Inhalt im nächsten Test noch da.

### Warten statt schlafen

Navigationen laden das Chunk der Zielroute nach; wie viele Ticks das dauert,
hängt von der Maschinenlast ab. Feste `setTimeout`-Wartezeiten sind deshalb
Flakes mit Ansage. `test/helpers/wait.ts` bietet `waitFor(predicate)` und
`waitForText(wrapper, text)`, die auf das Ergebnis pollen und mit lesbarer
Meldung ablaufen. Das Timeout lässt sich über `TEST_WAIT_TIMEOUT` (ms) anheben.

### E-Mail-Snapshots

`server/utils/mailSnapshots.spec.ts` legt jede ausgehende Mail als Ganzes fest.
Die Templates sind reine Funktionen ihres Kontextes — keine Zeitstempel, kein
Zufall, IDs kommen von außen —, also sind die Snapshots ohne weitere Vorkehrung
deterministisch.

Warum zusätzlich zu den Verhaltens-Specs daneben: `orderMail.spec.ts` & Co.
prüfen, was jemandem eingefallen ist („dieser Link muss drin sein", „dieser Name
muss escaped werden"). Sie sagen nichts über alles, wofür niemand eine Assertion
geschrieben hat — einen verschobenen Betrag, eine weggefallene Footer-Zeile, eine
Tabellenspalte ohne Kopf. Diese Mails sind das einzige Dokument, das der Kunde
über einen gerade geschlossenen Vertrag bekommt; diese stille Fläche ist es wert,
komplett festgehalten zu werden.

Die Snapshots liegen in `server/utils/__mail__/` als **echte Dateien**:

- `*.html` lässt sich im Browser öffnen — der Snapshot ist gleichzeitig die
  Design-Vorschau, und ein Diff im Review liest sich als HTML statt als escapter
  Block.
- `*.txt` ist die Mail als Plain-Text-Mail: `Subject:` (und `Reply-To:`, wo das
  Template eins setzt) als Kopfzeilen, dann der Body. Der Betreff ändert sich
  häufiger als alles andere und gehört ins selbe Artefakt.

Zehn Fälle über sechs Templates: pro Template eine voll bestückte Mail, dazu die
Varianten, die die Struktur wirklich ändern (Versand 0 € → „nach Aufwand", Kunde
ohne Namen, Bestellung ohne Bankdaten/Anmerkungen, manuelle Freigabe im Admin mit
Begründung).

Nach einer **beabsichtigten** Änderung mit `npm run test:unit -- -u` erneuern —
und den Diff lesen, das ist der eigentliche Zweck.

## Coverage-Ratchet

Die Schwellwerte in `vitest.config.ts` sind ein **Boden, der nur steigt**. Es
gibt genau einen globalen Satz Schwellen — keine pfadabhängigen Ausnahmen, damit
nicht einzelne Ecken stillschweigend zurückfallen können.

**Vorgehen beim Erweitern:** Tests schreiben → `npm run test:unit` → die
erreichten Werte als neue Schwellen eintragen. Schwellen werden nie gesenkt; wenn
ein Wert fällt, fehlt ein Test.

Stand: 1024 Tests, **100 % in allen vier Maßen**.

### Vue-SFCs und der v8-Provider

Ein Fallstrick, falls die Branch-Zahl wieder abrutscht: Der v8-Provider rechnet
seine Byte-Ranges über Sourcemaps auf die Quelle zurück, und bei einer
Seitenkomponente mit `await` **und** `throw` im `setup` erfindet diese Umrechnung
Branch-Zähler auf Template-Zeilen, die es im kompilierten Modul gar nicht gibt —
sie stehen dann auf beiden Seiten dauerhaft bei 0 und sind durch keinen Test
erreichbar.

Erkennbar ist der Fall daran, dass für dieselbe Template-Zeile ein `cond-expr`
mit echten Zahlen *und* ein `if` mit `[0, 0]` im Report steht. Gegenmittel ist
kein Test, sondern die Trennung: den darstellenden Teil in eine Komponente mit
synchronem, prop-getriebenem `setup` ziehen und die Route-Komponente auf Laden,
Weiterleiten und Metadaten beschränken. Genau das ist der Grund, warum
`ShopProductDetail` neben `pages/shop/[...path].vue` steht — die Aufteilung ist
ohnehin die klarere, und alle 25 Tests der Seite liefen danach unverändert durch.

### Bewusst ausgenommener Code

`/* v8 ignore start|stop */` steht an drei Stellen, jeweils mit Begründung im
Code: die `import.meta.server`-Zweige in `useStorage`, `useConsent` und
`useCart`. Das ist eine Build-Zeit-Konstante, im Client-Build — dem, den die Unit
-Suite ausführt — immer `false`.

### Was dabei am Produktivcode auffiel

Der Weg auf 100 % hat mehr toten Code gefunden als Testlücken. Entfernt bzw.
vereinfacht wurden unter anderem: neunmal ein wirkungsloses
`getRequestIP(...) ?? undefined` (h3 liefert bereits `string | undefined`), zwei
`catch`-Blöcke um `Buffer.from(..., 'base64')`, das nie wirft, der `lastOrderId`
-Zustand des Warenkorbs (seit dem Pending-Flow immer `null`), die tote
`'up'`-Richtung in `getTargetSection` der Startseite und mehrere Fallbacks, die
hinter einer bereits prüfenden Bedingung standen.

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

Dazu die Kategorie „Lebensmittel" mit „Salz" und dem Unterkategorie-Produkt
„Zwieback". Beide sind in der DB **aktiv** und müssen trotzdem unsichtbar
bleiben — sie prüfen den Katalog-Filter (`HIDDEN_CATEGORY_SLUGS` in
`server/utils/catalog.ts`). Der sichtbare Kategoriebaum heißt deshalb
„Naturkost", nicht „Lebensmittel".

Dazu 30 Füll-Produkte („Zubehör 01…30"), damit das Grid überhaupt paginiert —
die Seitengröße ist 24. Sie sind bewusst so benannt, dass sie **hinter** den
handgeschriebenen Fixtures einsortieren: das Grid sortiert nach Aufrufzahl,
dann Name, und die übrigen Specs erwarten Honig, Brot, Karte und Olivenöl auf
der ersten Seite. Die 38 aktiven DB-Zeilen ergeben 34 Grid-Produkte: zwei fallen
als Lebensmittel weg, und `groupProducts` fasst die Varianten von Olivenöl und
Karte je zusammen. Das Admin-Dashboard zählt dagegen 38 — es berichtet den Stand
der osCommerce-Datenbank, nicht das Sortiment dieses Shops.

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

Formularfelder und Buttons werden über ihren **Accessible Name** angesprochen
(`getByLabel`, `getByRole`). Das ist kein Stilentscheid: die Tests fallen damit
um, sobald ein Label fehlt oder ein Button seinen Namen verliert — sie prüfen
also nebenbei mit, dass die Oberfläche mit Screenreader bedienbar bleibt.

`data-testid` bleibt nur für Anker ohne eigene Semantik. Aktuell sind das fünf:

| Testid | Warum kein semantischer Selektor |
| --- | --- |
| `product-card` | Container ohne Rolle; dient dem Eingrenzen auf ein Produkt |
| `product-price` | reine Zahl, kein Accessible Name |
| `cart-sidebar` | wird auch für DOM-Prüfungen des Fokus gebraucht |
| `cart-total`, `cart-success` | Zustandsanker im Warenkorb |

### Kategoriefilter

`e2e/filter.spec.ts` hält das Verhalten des Shop-Filters fest, weil es an
mehreren Stellen gleichzeitig hängt (URL, Suche, Zählwerte):

- Ohne `?kategorie` gilt die **erste Kategorie mit Produkten** und darin die
  erste solche Unterkategorie. Leere Kategorien werden übersprungen — der Filter
  graut sie aus, also darf keine davon vorausgewählt sein.
- „Alle" steht am Ende beider Leisten und ist als `?kategorie=alle` explizit in
  der URL. Ein Link auf `/shop` bleibt dadurch parameterfrei und ohne
  Weiterleitung, und jeder Zustand ist teilbar.
- Eine laufende **Suche schaltet auf „Alle"** um. Andernfalls meldet der Shop
  „nichts gefunden", während Treffer eine Kategorie weiter liegen. Die vorher
  aktive Kategorie wird gemerkt und beim Leeren des Suchfelds wiederhergestellt
  — auch dann, wenn das ein bewusst gewähltes „Alle" war.
- **Lebensmittel** kommen im Katalog gar nicht mehr vor: kein Filter-Button,
  keine Karten unter „Alle", kein Suchtreffer, 404 auf der Detailroute. Ein
  alter Link auf `?kategorie=lebensmittel` fällt auf die Standardkategorie
  zurück statt auf einen leeren Shop.

Weil die Startseite nun gefiltert ist, landet `openShop()` aus den Helpern
standardmäßig auf `?kategorie=alle`. Specs, die ein bestimmtes Fixture-Produkt
brauchen, sollen sich nicht um Kategoriegrenzen kümmern müssen.

### Nachladen beim Scrollen

`e2e/lazy-load.spec.ts` sichert das Verhalten des Produktgrids ab. Wichtig für
das Verständnis der Tests: es wird **nichts nachgeladen** — der Katalog liegt
komplett in der Seite und wird nur zugeschnitten. „Geladen" heißt also
„gerendert", es muss auf keinen Request gewartet werden.

Zwei Fälle, die auf den ersten Blick widersprüchlich wirken und deshalb beide
festgehalten sind:

- Wird die Ansicht **vom Seitenanfang aus** eingeschränkt, bleibt es bei einer
  Seite plus Button.
- Wird sie eingeschränkt, **während der Nutzer unten steht**, füllt sich die
  kürzere Trefferliste sofort wieder auf. Der Sentinel ist ja noch im Blick.
  Das ist gewollt: sonst stünde man vor einem „Mehr anzeigen"-Button, an dem man
  bereits vorbeigescrollt ist.

## Barrierefreiheit

`e2e/a11y.spec.ts` hält den erreichten Stand fest.

**Labels.** Alle Formularelemente sind über `for`/`id` gekoppelt (IDs aus
`useId()`, SSR-sicher und pro Komponenteninstanz eindeutig — wichtig für die
Produktkarte, die pro Seite vielfach gerendert wird). Wo ein sichtbares Label
Layout-Umbau bedeutet hätte (Suchfelder, Varianten-Dropdown der Karte), steht ein
`aria-label`. Ein Placeholder zählt ausdrücklich nicht: er verschwindet beim
Tippen.

Der Test `every control … is labelled` prüft das **generisch** — er sammelt alle
sichtbaren `input`/`select`/`textarea` ohne Accessible Name ein. Damit fällt auch
ein künftig neu hinzugefügtes Feld auf, nicht nur die heute bekannten. Genau so
kam beim Bau das Suchfeld auf der Shop-Seite ans Licht, das in der manuellen
Bestandsaufnahme durchgerutscht war.

**Dialoge.** Warenkorb, Cookie-Hinweis, Willkommens-Overlay und der
Storage-Hinweis sind `role="dialog"` + `aria-modal` + `aria-labelledby`.
Verhalten in `app/composables/useModal.ts`: Escape schließt, Fokus wandert beim
Öffnen ins Panel und beim Schließen zum Auslöser zurück, Tab bleibt im Dialog.
Beim Cookie-Dialog bedeutet Escape **Ablehnen** — jemanden ohne Tastaturausweg
darin festzuhalten wäre schlechter, und Ablehnen ist die datensparsame Vorgabe.

Der Login/Registrierungs-Umschalter ist ein `role="tablist"`. Das ist inhaltlich
richtig und löst nebenbei die Doppeldeutigkeit zwischen dem Reiter „Anmelden" und
dem gleichnamigen Absende-Button.

### Automatischer Scan (axe)

`e2e/a11y.axe.spec.ts` fährt zusätzlich einen maschinellen WCAG-Scan über 14
Ansichten; die Mechanik steht in `e2e/helpers/axe.ts`.

**Warum beides und nicht nur eins.** Die beiden Suiten finden disjunkte Dinge.
axe kann kein Escape drücken, nicht sagen wohin der Fokus gesprungen ist und
keine Touch-Zielgröße messen — dafür ist `a11y.spec.ts` da. Die handgeschriebene
Suite prüft umgekehrt nur, woran jemand gedacht hat; axe ergänzt
Kontrastverhältnisse, ungültiges ARIA, Landmark- und Überschriftenstruktur,
doppelte IDs.

**Ruleset.** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` — der
normative Satz, und die Messlatte, die das BFSG an Onlinehandel anlegt.
`best-practice` ist bewusst draußen: das sind Empfehlungen, keine Konformität,
und sie würden die Baseline mit Rauschen füllen.

**Was gescannt wird.** Dialoge werden im *geöffneten* Zustand gescannt — dort
sitzen die härtesten Probleme, und ein Scan der Seite dahinter sieht sie nicht.
Der Checkout wird Schritt für Schritt gescannt: eine Route, aber vier Bildschirme.
Der Übersichts-Schritt hört vor „Bestellung absenden" auf; ein Scan hat keine
Bestellungen zu schreiben.

#### Die Baseline

`e2e/a11y-baseline.json` hält fest, welche Regeln heute pro Ansicht verletzt
sind. Eine Regel, die *nicht* drinsteht, lässt den Test fehlschlagen. Das ist
derselbe Ratchet-Gedanke wie bei der Coverage: ein Boden, der nur sinkt. Wird
eine Regel repariert, schlägt der Test **ebenfalls** fehl und verlangt, den
Eintrag zu entfernen — sonst würde er später stillschweigend eine Regression
wieder abdecken.

Die Baseline hängt an **Regel-IDs, nicht an einzelnen Knoten.** axe meldet einen
Knoten pro betroffenem Element, ein Kontrastproblem auf der Produktkarte also
einmal pro Karte — die Zahl bewegt sich damit mit den Seed-Fixtures statt mit dem
Code. Regel-IDs sind gegen beides stabil. Die vollständige Knotenliste
(Selektoren, HTML, Fix-Hinweis) hängt als JSON am Playwright-Report, das Beheben
hat also trotzdem Adressen.

Erneuern nach einer beabsichtigten Änderung: `npm run test:e2e:a11y:update`.

#### Offener Stand

Vier Regeln stehen in der Baseline. Keine davon betrifft ARIA, Landmarks oder
IDs — die manuelle Arbeit trägt.

| Regel | WCAG | Befund |
| --- | --- | --- |
| `html-has-lang` | 3.1.1 (A) | `<html>` hat kein `lang`. Betrifft jede Ansicht; Screenreader sprechen die deutschen Texte mit englischer Phonetik. Einzeiler in `nuxt.config.ts` (`app.head.htmlAttrs`). |
| `link-name` | 2.4.4 / 4.1.2 (A) | 45 Links ohne Accessible Name im Shop-Grid: der Bild-Link der Produktkarte, und der Beschreibungs-Link bei Produkten **ohne** Beschreibung (`<a><p></p></a>` — leer, aber in der Tab-Reihenfolge). |
| `color-contrast` | 1.4.3 (AA) | Markengrün `#00af8c` auf Weiß ergibt **2,79:1** (nötig: 4,5:1), die grauen Footer-Links `#888888` ergeben 3,54:1. Betrifft Fließtext-Verwendungen; für große Flächen gilt der Wert nicht. |
| `target-size` | 2.5.8 (AA, 2.2) | „Passwort vergessen?" im Login ist 17 px hoch. |

`link-name` und `html-has-lang` sind Level A und rein technisch zu beheben;
`color-contrast` ist eine Gestaltungsentscheidung am Markengrün und deshalb
bewusst in der Baseline geparkt statt vorschnell überschrieben.
