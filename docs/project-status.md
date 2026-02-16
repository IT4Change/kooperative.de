# Projektstatus: kooperative.de

Letzte Aktualisierung: 2026-02-16

## Phasenübersicht

### Phase 1: Fundament — ERLEDIGT (Code geschrieben)
- [x] Astro 5 Projekt initialisiert (`frontend/package.json`, `astro.config.mjs`, `tsconfig.json`)
- [x] Strapi 5 Projekt initialisiert (`cms/package.json`, Config-Dateien, `Dockerfile`)
- [x] `docker-compose.dev.yml` für lokale Entwicklung
- [x] Alle 10 Strapi Content Types + 3 Shared Components angelegt
- [x] BaseLayout, Header, Footer, MainNav, MobileNav.vue, InfoNav
- [x] Strapi Fetch-Helper (`lib/strapi.ts`) + TypeScript Types (`lib/types.ts`)
- [x] Homepage (`pages/index.astro`)
- [x] Info-Seiten (`pages/[slug].astro` für Historie, Kontakt, Impressum, Datenschutz)
- [x] Tailwind-Theme definiert (Farben: primary/green, accent/pink, warm/amber; Fonts: Source Sans 3 + Source Serif 4)

### Phase 2: Inhaltsbereiche — ERLEDIGT (Code geschrieben)
- [x] ContentLayout mit Sidebar-Navigation
- [x] Section-Übersichtsseiten (Arbeit, Kultur, Bildung, Gäste) — je `index.astro`
- [x] Dynamische Sub-Page Routen (`[slug].astro`) pro Section
- [x] ImageGallery-Komponente
- [x] ExternalLinkCard für WWW-Einträge
- [x] RichText + Breadcrumb Komponenten
- [ ] **OFFEN: Sample-Content in Strapi eintragen** (erst nach erstem Start möglich)

### Phase 3: Kalender & Events — ERLEDIGT (Code geschrieben)
- [x] Event-Seiten pro Section (`veranstaltungen.astro` für Kultur, Bildung, Gäste)
- [x] EventCard + EventList Komponenten
- [x] CalendarView.vue (Monats-/Listenansicht, deutsche Monate/Tage)
- [x] Aggregierte Kalenderseite (`/kalender`)

### Phase 4: Shop – Produktkatalog — ERLEDIGT (Code geschrieben)
- [x] ShopLayout mit Kategorie-Sidebar
- [x] Bestellungs-Startseite ("Wie es geht") — `bestellung/index.astro`
- [x] Kategorie-Listenseiten — `bestellung/[category]/index.astro`
- [x] Subcategory-Listenseiten — `bestellung/[category]/[subcategory].astro`
- [x] Produkt-Detailseiten — `bestellung/produkt/[slug].astro`
- [x] SearchBar.vue mit Fuse.js
- [x] ProductCard, ProductGrid Komponenten
- [x] CategorySidebar.vue
- [ ] **OFFEN: Produkt-Kategorien, Subcategories + Beispielprodukte in Strapi** (erst nach Start)

### Phase 5: Shop – Warenkorb & Bestellung — ERLEDIGT (Code geschrieben)
- [x] nanostores Cart-Store mit localStorage (`lib/cart.ts`)
- [x] AddToCartButton.vue, CartIcon.vue, CartDrawer.vue
- [x] OrderForm.vue + OrderConfirmation.vue
- [x] Custom Strapi Order-Endpoint mit E-Mail-Versand (`cms/src/api/order/controllers/order.ts`)
- [x] Rate-Limiting Middleware (5/IP/Stunde)
- [x] Strapi Email-Plugin konfiguriert (nodemailer + SMTP in `cms/config/plugins.ts`)
- [ ] **OFFEN: End-to-End Test** (Produkt → Warenkorb → Bestellung → E-Mail)

### Phase 6: Deployment & Feinschliff — OFFEN
- [ ] `npm install` in `frontend/` ausführen und Build testen
- [ ] `docker compose -f docker-compose.dev.yml up` testen (Strapi + PostgreSQL)
- [ ] Frontend Dev-Server gegen laufendes Strapi testen
- [ ] VPS einrichten, Docker Compose deployen
- [ ] DNS + SSL (Let's Encrypt)
- [ ] Strapi Webhook → Astro Rebuild konfigurieren
- [ ] Lighthouse-Audit + Performance-Optimierung
- [ ] Datenbank-Backups (Cron)
- [ ] Echte Inhalte einpflegen
- [ ] QA auf allen Geräten (Desktop, Tablet, Mobile)
- [ ] robots.txt + sitemap.xml (Astro-Sitemap-Integration ist konfiguriert)

---

## Bekannte offene Punkte / Risiken

1. **Noch nicht getestet** — Der gesamte Code wurde in einer Session geschrieben, aber noch kein `npm install` oder Build ausgeführt. Erste Priorität beim nächsten Mal.

2. **Strapi 5 API-Format** — Die Strapi-Fetch-Funktionen in `strapi.ts` gehen vom Strapi 5 Response-Format aus (`response.data` als Array/Objekt). Falls sich das Format unterscheidet, muss `strapi.ts` angepasst werden.

3. **Astro Path-Aliases** — `tsconfig.json` definiert `@/*` → `src/*`. In den Pages werden relative Imports verwendet (`../../lib/strapi`). Falls Alias-Probleme auftreten, auf relative Imports umstellen.

4. **Preise in Cent** — Alle Preise werden als Integer in Cent gespeichert (Strapi: `price: integer`). `formatPrice()` in `cart.ts` und `ProductCard` rechnet /100 für die Anzeige.

5. **CalendarView.vue auf kalender.astro** — Verwendet aktuell ein manuelles Client-Side-Mount-Script statt `client:visible`. Ggf. auf Standard-Astro-Island umstellen, falls Probleme auftreten.

6. **Header Cart-Badge** — Der Header verwendet ein Astro-`<script>`-Tag mit nanostore-Subscription für den Badge-Counter (kein Vue-Island). Funktioniert, weil nanostores framework-agnostisch ist.

---

## Dateiübersicht (104 Dateien)

### Frontend: Layouts (3)
- `frontend/src/layouts/BaseLayout.astro`
- `frontend/src/layouts/ContentLayout.astro`
- `frontend/src/layouts/ShopLayout.astro`

### Frontend: Layout-Komponenten (5)
- `frontend/src/components/layout/Header.astro`
- `frontend/src/components/layout/Footer.astro`
- `frontend/src/components/layout/MainNav.astro`
- `frontend/src/components/layout/InfoNav.astro`
- `frontend/src/components/layout/MobileNav.vue`

### Frontend: Common-Komponenten (5)
- `frontend/src/components/common/Hero.astro`
- `frontend/src/components/common/ImageGallery.astro`
- `frontend/src/components/common/RichText.astro`
- `frontend/src/components/common/ExternalLinkCard.astro`
- `frontend/src/components/common/Breadcrumb.astro`

### Frontend: Kalender-Komponenten (3)
- `frontend/src/components/calendar/CalendarView.vue`
- `frontend/src/components/calendar/EventCard.astro`
- `frontend/src/components/calendar/EventList.astro`

### Frontend: Shop-Komponenten (9)
- `frontend/src/components/shop/ProductCard.astro`
- `frontend/src/components/shop/ProductGrid.astro`
- `frontend/src/components/shop/SearchBar.vue`
- `frontend/src/components/shop/AddToCartButton.vue`
- `frontend/src/components/shop/CartIcon.vue`
- `frontend/src/components/shop/CartDrawer.vue`
- `frontend/src/components/shop/OrderForm.vue`
- `frontend/src/components/shop/OrderConfirmation.vue`
- `frontend/src/components/shop/CategorySidebar.vue`

### Frontend: Seiten (18)
- `pages/index.astro` — Homepage
- `pages/[slug].astro` — Info-Seiten (Historie, Kontakt, Impressum, Datenschutz)
- `pages/arbeit/index.astro` + `[slug].astro`
- `pages/kultur/index.astro` + `[slug].astro` + `veranstaltungen.astro`
- `pages/bildung/index.astro` + `[slug].astro` + `veranstaltungen.astro`
- `pages/gaeste/index.astro` + `[slug].astro` + `veranstaltungen.astro`
- `pages/kalender.astro`
- `pages/bestellung/index.astro`
- `pages/bestellung/[category]/index.astro`
- `pages/bestellung/[category]/[subcategory].astro`
- `pages/bestellung/produkt/[slug].astro`

### Frontend: Lib (3)
- `frontend/src/lib/strapi.ts` — Strapi API Helper
- `frontend/src/lib/types.ts` — TypeScript Interfaces
- `frontend/src/lib/cart.ts` — Warenkorb-Store (nanostores)

### CMS: Content Types (10 × schema.json + controller + route)
homepage, section, sub-page, event, external-link, product, product-category, product-subcategory, page, order

### CMS: Shared Components (3)
- `cms/src/components/shared/seo.json`
- `cms/src/components/shared/gallery-image.json`
- `cms/src/components/shop/order-item.json`

### CMS: Custom Middleware
- `cms/src/api/order/middlewares/rate-limit.ts`

### Infrastruktur
- `docker-compose.yml` (Produktion: Strapi + PostgreSQL + Nginx + Certbot)
- `docker-compose.dev.yml` (Entwicklung: Strapi + PostgreSQL)
- `nginx/conf.d/default.conf`
- `scripts/deploy.sh`
- `cms/Dockerfile`
- `.env.example` + `cms/.env.example`
- `.gitignore`

---

## Nächste Schritte (in Reihenfolge)

1. **`cd frontend && npm install`** — Dependencies installieren
2. **`npm run build`** testen — Kompilierungsfehler finden und beheben
3. **`docker compose -f docker-compose.dev.yml up`** — Strapi + PostgreSQL starten
4. **Strapi Admin** unter http://localhost:1337/admin einrichten (Admin-User anlegen)
5. **API-Berechtigungen** in Strapi setzen (Public-Rolle: find/findOne für alle Content Types außer Order)
6. **Sample-Content** eintragen (Sektionen, Subpages, Produkte, Kategorien)
7. **Frontend Dev-Server** gegen Strapi testen (`PUBLIC_STRAPI_URL=http://localhost:1337 npm run dev`)
8. **Build-Fehler beheben** — Import-Pfade, fehlende Props etc.
9. **E2E Shop-Flow** testen (Produkt → Warenkorb → Bestellung)
10. **Deployment vorbereiten** (VPS, DNS, SSL)
