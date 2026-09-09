# Tests & Linting

Alle Kommandos laufen in `app/`.

| Kommando | Was es tut |
| --- | --- |
| `npm run test:lint` | ESLint + Typecheck (das, was die CI als Gate fährt) |
| `npm run test:lint:eslint` | ESLint mit `--max-warnings 0` |
| `npm run test:lint:typecheck` | `vue-tsc --noEmit` |
| `npm run test:unit` | Vitest einmalig inkl. Coverage-Gate |
| `npm run test:unit:dev` | Vitest im Watch-Modus |

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
Pool-Mock), Komponenten-Rendering, e2e.
