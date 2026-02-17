# Kooperative Dürnau

Neue Website der Kooperative Dürnau eG -- Leben und Arbeiten in Gemeinschaft seit 1980.

**Live:** https://it4change.github.io/kooperative.de/

## Tech Stack

| Technologie | Version | Zweck |
|------------|---------|-------|
| Nuxt | 4.3 | Framework (SPA, Static Generation) |
| Vue | 3.5 | UI-Komponenten |
| Tailwind CSS | via @nuxtjs/tailwindcss 6.14 | Styling |
| GitHub Pages | - | Hosting (Static) |
| GitHub Actions | - | CI/CD (Auto-Deploy bei Push auf master) |

## Projektstruktur

```
kooperative.de/
├── app/                         # Nuxt 4 Anwendung
│   ├── app/
│   │   ├── app.vue              # Root-Komponente (Layout + Page)
│   │   ├── layouts/
│   │   │   └── default.vue      # Layout: Header, Footer, Mobile-Menü
│   │   ├── pages/
│   │   │   └── index.vue        # Startseite (alle Sektionen)
│   │   └── assets/css/
│   │       └── main.css         # Globale Styles (scroll-behavior)
│   ├── public/
│   │   ├── img/
│   │   │   ├── hero.jpg         # Hero-Hintergrund (Sonnenaufgang)
│   │   │   ├── logo.gif         # Kooperative-Logo
│   │   │   └── sections/        # Sektions-Hintergrundbilder
│   │   ├── favicon.ico
│   │   ├── robots.txt
│   │   └── .nojekyll
│   ├── nuxt.config.ts           # Nuxt-Konfiguration
│   └── package.json
├── docs/
│   ├── wwweb.pdf                # Original-Sitemap
│   ├── PROJECT.md               # Projektdefinition
│   ├── IMG.md                   # Bildübersicht
│   └── img/                     # Alle heruntergeladenen Bilder
├── .github/workflows/
│   └── deploy.yml               # GitHub Pages Deployment
└── README.md
```

## Startseite (Single Page)

Die Startseite ist als vertikale Fullscreen-Abfolge aufgebaut:

| Sektion | Farbe | Hintergrundbild | Inhalt |
|---------|-------|-----------------|--------|
| **Hero** | - | Sonnenaufgang (Unsplash) | Titel, Claim, Kurzbeschreibung |
| **Bestellung** | Grün | Gemüseregal (Unsplash) | 8 Shop-Kategorien + CTA "Zum Shop" |
| **Arbeit** | Gold | Werkzeug (Unsplash) | 5 Betriebe |
| **Kultur** | Rot | Theatersaal (Unsplash) | 5 Kulturbereiche |
| **Bildung** | Blau | Bücher (Unsplash) | 5 Bildungsbereiche |
| **Gäste** | Lila | Berglandschaft (Unsplash) | 5 Gästebereiche |

### Features

- **Scroll-Snapping**: Nach unten → springt zur nächsten Sektion; nach oben → frei (nur Hero rastet ein)
- **Shrinking Header**: Menü verkleinert sich beim Runterscrollen, wird groß beim Hochscrollen
- **Grüne Info-Leiste**: Versteckt sich beim Scrollen
- **Active-Section-Highlighting**: Menüeinträge werden hervorgehoben wenn Sektion sichtbar (IntersectionObserver)
- **Logo-Highlight**: Logo wird größer + Glow wenn Hero sichtbar
- **Mobile**: Hamburger-Menü, responsive Grids, angepasste Schriftgrößen
- **Externe Links**: Shop-Kategorien → shop.kooperative.de, Betriebe/Kultur/Bildung → eigene Websites

## Deployment

Automatisch via GitHub Actions bei Push auf `master`:

1. `npm ci` im `app/`-Verzeichnis
2. `npx nuxt generate` erstellt statische Dateien
3. Deploy nach GitHub Pages unter `/kooperative.de/`

Manuell: **Settings → Pages → Source: GitHub Actions**

---

## Sitemap (aus docs/wwweb.pdf)

### Hauptnavigation

| Bereich | Beschreibung |
|---------|-------------|
| **Kooperative Dürnau** | Startseite |
| **Bestellung** | Online-Shop |
| **Arbeit** | Arbeitsbereiche der Kooperative |
| **Kultur** | Kulturangebote |
| **Bildung** | Bildungsangebote |
| **Gäste** | Informationen für Gäste |

### Info (global)

Historie, Kontakt, Impressum, Datenschutz

### Bestellung (Shop)

| Kategorie | Unterkategorien |
|-----------|----------------|
| **Bücher** | Kooperative, Andere, Gebrauchte, Kataloge, Karten, Noten |
| **Papeterie** | Bücher, Notizblöcke, Postkarten, Poster |
| **Medien** | Texte, Sprache, Filme, Musik |
| **Sonett** | Wäsche, Geschirr, Putzmittel, Körperpflege, Zubehör |
| **Körperpflege** | Gesicht, Mund & Zähne, Haut & Haare, Hand & Fuss, Bad & Dusche, Anwendungen |
| **Holz** | Spiele, Türen, Stühle, Särge |

### Arbeit

Bau, Druckerei, Schreinerei, Gärtnerei Morgengrauen (extern), Allround Dienst Reisiger

### Kultur

Veranstaltungen, Theater, Landwirtschaft, Kulturfond, poinz zero (extern) -- gemeinsamer Kalender

### Bildung

Veranstaltungen, Sprache, Bienen, Praktika, Dorfuniversität (extern) -- gemeinsamer Kalender

### Gäste

Veranstaltungen, Orientierung, Lernen, Hilfe, Tagesgäste -- gemeinsamer Kalender

---

## Verlinkte externe URLs

### Shop (shop.kooperative.de)

| Bereich | URL |
|---------|-----|
| Shop Startseite | https://shop.kooperative.de/ |
| Bücher | https://shop.kooperative.de/buecher_aktuell.php |
| Papeterie | https://shop.kooperative.de/papeterie_aktuell.php |
| Medien | https://shop.kooperative.de/medien_aktuell.php |
| Sonett | https://shop.kooperative.de/sonett_aktuell.php |
| Körperpflege | https://shop.kooperative.de/koerperpflege_aktuell.php |
| Holz | https://shop.kooperative.de/holz_aktuell.php |
| Lebensmittel | https://shop.kooperative.de/lebensmittel_aktuell.php |
| Diverses | https://shop.kooperative.de/diverses_aktuell.php |

### Externe Websites

| Bereich | URL |
|---------|-----|
| Gärtnerei Morgengrauen | https://www.gaertnerei-morgengrauen.de/ |
| poinz zero (Fercher von Steinwand e.V.) | https://www.ferchervonsteinwand.org/ |
| Dorfuniversität | https://www.dorf-uni.de/ |

### Noch ohne externe URL

Bau, Druckerei, Schreinerei, Allround Dienst Reisiger

---

## Bestehende Websites (Referenz)

| Website | Typ | Technik |
|---------|-----|---------|
| [kooperative.de](https://www.kooperative.de/) | Hauptseite | Statisches HTML, GIF, JS-Popups |
| [gaertnerei-morgengrauen.de](https://www.gaertnerei-morgengrauen.de/) | Gärtnerei | Statisches HTML |
| [dorf-uni.de](https://www.dorf-uni.de/) | Dorfuniversität | PHP |
| [ferchervonsteinwand.org](https://www.ferchervonsteinwand.org/) | Kulturverein | Frames, DE/EN |
| [restderwelt.de](https://www.restderwelt.de/) | Privat | Planeten-Navigation |

---

## Arbeitsprotokoll

### 2026-02-17 -- Initiale Umsetzung

1. **Sitemap-Analyse**: `docs/wwweb.pdf` analysiert und Seitenstruktur dokumentiert
2. **Bestehende Websites dokumentiert**: 5 Websites analysiert (kooperative.de, gaertnerei-morgengrauen.de, dorf-uni.de, ferchervonsteinwand.org, restderwelt.de)
3. **Nuxt-Startseite erstellt**: Layout mit Header/Footer + Startseite mit allen Bereichen
4. **Tailwind CSS installiert**: `@nuxtjs/tailwindcss` Modul
5. **Hero-Sektion**: 100vh mit Hintergrundbild, Text-Overlay
6. **Suche aus Header entfernt**
7. **Logo im Menü**: Kooperative-Logo als Bild eingebaut
8. **Shrinking Header**: Fixed-Menü das sich beim Scrollen verkleinert (Scroll-Richtung-aware)
9. **Grüne Info-Leiste**: Versteckt sich beim Runterscrollen
10. **Bestellung-Sektion**: 100vh, 8 Shop-Kategorien mit externen Links zu shop.kooperative.de, CTA "Zum Shop"
11. **Arbeit-Sektion**: 100vh, 5 Betriebe, externe Links wo vorhanden
12. **Kultur-Sektion**: 100vh, 5 Bereiche, poinz zero → ferchervonsteinwand.org
13. **Bildung-Sektion**: 100vh, 5 Bereiche, Dorfuniversität → dorf-uni.de
14. **Gäste-Sektion**: 100vh, 5 Bereiche
15. **Bilder von bestehenden Websites heruntergeladen**: 24 Bilder in docs/img/
16. **Hintergrundbilder**: Stock Photos von Unsplash für alle Sektionen + Hero
17. **Lesbarkeit**: Text-Schatten + dunkle Overlays auf allen Sektionen
18. **Scroll-Snapping**: JS-basiert -- runter springt zur nächsten Sektion, hoch ist frei (Hero rastet ein)
19. **Mobiloptimierung**: Hamburger-Menü, responsive Grids/Schriftgrößen, min-h-screen auf Mobile
20. **Active-Section-Highlighting**: IntersectionObserver markiert aktiven Menüeintrag
21. **Logo-Highlight**: Logo wird größer + Glow wenn Hero sichtbar
22. **GitHub Pages Deployment**: GitHub Actions Workflow, baseURL-Fix für Bild-Pfade
