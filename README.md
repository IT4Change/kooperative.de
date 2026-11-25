# Kooperative Dürnau

Website und Online-Shop der Kooperative Dürnau – Nachfolger der statischen
Seite und des osCommerce-Shops `shop.kooperative.de`.

- **Staging:** https://neu.kooperative.de
- **Altshop:** https://shop.kooperative.de (läuft parallel weiter)

## Überblick

```
Browser ──► nginx ──► Nuxt 4 (SSR, ein Node-Prozess via pm2)
                        ├─ Website, Shop, Rechtstexte
                        ├─ /api      Login, Warenkorb, Bestellung
                        └─ /admin    Bestellungen, Kunden, Produkte, Rechtstexte
                              │
                              ▼
                   MariaDB (gemeinsam mit dem Altshop)
                   osCommerce-Tabellen + eigene koop_*-Tabellen
```

- **Eine Datenbank für beide Shops.** Der neue Shop liest und schreibt die
  osCommerce-Tabellen so, dass der Altshop und sein Admin unverändert weiter
  funktionieren. Eigene Daten liegen in `koop_*`-Tabellen. Jeder Schreibpfad ist
  in [docs/DB_WRITES.md](docs/DB_WRITES.md) aufgeführt.
- **Altshop-Patches** ändern keine bestehende Datei:
  [legacy-shop/README.md](legacy-shop/README.md).
- **Rechtstexte** sind versioniert, kommen aus der Datenbank und gelten für
  beide Shops. Die Texte selbst stehen nicht im Repository (siehe unten).

## Lokal starten

```sh
docker compose up -d            # MariaDB (3306) + maildev (SMTP 1025, Web-UI 1080)
cd app
cp .env.template .env           # Defaults passen zum Compose-Stack
npm ci
node scripts/migrate.mjs        # koop_*-Tabellen anlegen
npm run dev                     # http://localhost:3000
```

Admin lokal: `/admin`, Zugang aus `ADMIN_USERS` (Default `admin:admin`).

## Konfiguration

Alle Variablen mit Kommentar in [`app/.env.template`](app/.env.template). In
Stage und Produktion gehören die echten Werte nur auf den Server – das
Repository ist öffentlich.

| Variable | Zweck |
|---|---|
| `DB_*` | Verbindung zur gemeinsamen Datenbank |
| `SESSION_SECRET` | Signiert die Login-Cookies; ≥ 32 Zeichen, z. B. `openssl rand -base64 48`. Ohne gültigen Wert verweigert Produktion den Login (503) |
| `ADMIN_USERS` | Basic-Auth für `/admin`, `user:pass,user2:pass2`. Ohne Wert ist der Admin in Produktion gesperrt |
| `ALLOW_DB_WRITES` | `false` macht den Shop schreibgeschützt (Stage) |
| `SMTP_*`, `MAIL_FROM`, `MAIL_OPERATOR` | Mailversand; `MAIL_OPERATOR` bekommt die Bestellmails |
| `PUBLIC_BASE_URL`, `ADMIN_BASE_URL` | Basis für Links in Mails (sonst aus dem Request-Host) |
| `COMPANY_*` | Pflichtangaben im Mail-Footer (§ 35a GmbHG, § 125a HGB) |

## Rechtstexte

Die Texte liegen nicht im Repository, sondern versioniert in der Datenbank.
Gepflegt werden sie im Admin unter *Rechtstexte*: neue Fassung einfügen,
speichern, live schalten. Live gilt sofort in beiden Shops. Lokale Entwürfe
gehören nach `legal/` (gitignored).

## Tests

In `app/`:

| Befehl | Prüft |
|---|---|
| `npm run test:lint` | ESLint + `vue-tsc` |
| `npm run test:unit` | Vitest mit Coverage-Gate (100 %) |
| `npm run e2e:stack:up && npm run test:e2e` | Playwright gegen eigenen Wegwerf-Stack (MariaDB 3307, maildev 1026) |

Jedes Gate läuft in der CI als eigener Workflow. Aufbau und Konventionen:
[docs/testing.md](docs/testing.md).

## Release & Deployment

1. Commits folgen Conventional Commits; der PR-Titel wird geprüft.
2. release-please pflegt einen Release-PR mit Version und `CHANGELOG.md`.
3. Wird er gemergt, entsteht ein GitHub-Release. Ein Webhook auf dem Server
   startet `.github/webhooks/deploy.sh`: Tag auschecken → `npm ci` → Build →
   DB-Migrationen → pm2-Neustart → prüfen, dass `/api/version` die neue Version
   meldet. Scheitert ein Schritt, bleibt die vorherige Version live.

Einrichtung von Webhook, pm2 und nginx: [.github/webhooks/README.md](.github/webhooks/README.md).

## Verzeichnisse

| Pfad | Inhalt |
|---|---|
| `app/` | Nuxt-Anwendung: `app/` (Frontend), `server/` (API, Admin-API, Mails), `e2e/`, `scripts/` |
| `database/` | Docker-Image der Dev-DB und `migrations/` (additiv, beim Deploy ausgeführt) |
| `legacy-shop/` | Patches für den Altshop |
| `docs/` | Doku, Bildmaterial, [Sitemap aus der Konzeptphase](docs/sitemap.md) |
| `.github/` | CI-Workflows, Release-Konfiguration, Deploy-Webhook |
