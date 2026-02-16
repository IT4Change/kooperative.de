# Kooperative Dürnau - Projektdefinition

## Projektziel

Website für die Kooperative Dürnau mit Informationsseiten, Veranstaltungskalender und Online-Bestellsystem (ohne Online-Zahlung).

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| **Frontend** | Astro 5 (Static Output) + Vue 3 (Islands) |
| **Styling** | Tailwind CSS |
| **CMS** | Payload CMS 3 (standalone, self-hosted) |
| **Datenbank** | PostgreSQL (für Payload) |
| **State (Client)** | nanostores + @nanostores/vue |
| **Suche** | Fuse.js (client-seitig) |
| **Hosting** | noch offen (lokal entwickeln, später entscheiden) |
| **Design** | kommt später (erstmal funktional) |

## Seitenstruktur (aus Sitemap)

### Hauptnavigation

1. **Kooperative Dürnau** - Startseite
2. **Bestellung** - Shop mit Warenkorb
3. **Arbeit** - Sektion mit Unterseiten
4. **Kultur** - Sektion mit Unterseiten + Veranstaltungen
5. **Bildung** - Sektion mit Unterseiten + Veranstaltungen
6. **Gäste** - Sektion mit Unterseiten + Veranstaltungen

### Info-Seiten (Footer/Sekundärnavigation)

- Historie
- Kontakt
- Impressum
- Datenschutz

### Sektionen & Unterseiten

| Sektion | Unterseiten | Externe Links (WWW) | Veranstaltungen |
|---------|-------------|---------------------|-----------------|
| **Arbeit** | Bau, Druckerei, Schreinerei | Gärtnerei Morgengrauen, Allround Dienst Reisiger | nein |
| **Kultur** | Theater, Landwirtschaft, Kulturfond | poinz zero | ja |
| **Bildung** | Sprache, Bienen, Praktika | Dorfuniversität | ja |
| **Gäste** | Orientierung, Lernen, Hilfe, Tagesgäste | - | ja |

### Shop (Bestellung)

**Ablauf:** Produkte durchstöbern → Warenkorb → Bestellformular (Name, Adresse etc.) → Bestellung per E-Mail

| Kategorie | Unterkategorien |
|-----------|----------------|
| **Bücher** | Kooperative, Andere, Gebrauchte, Kataloge, Karten, Noten |
| **Papeterie** | Bücher, Notizblöcke, Postkarten, Poster |
| **Medien** | Texte, Sprache, Filme, Musik |
| **Sonett** | Wäsche, Geschirr, Putzmittel, Körperpflege, Zubehör |
| **Körperpflege** | Gesicht, Mund & Zähne, Haut & Haare, Hand & Fuss, Bad & Dusche, Anwendungen |
| **Holz** | Spiele, Türen, Stühle, Särge |

### Querschnitt-Features

- **Kalender** - Sammelansicht aller Veranstaltungen (Kultur, Bildung, Gäste)
- **Suchen** - Produktsuche im Shop
- **"Wie es geht"** - Anleitung zur Bestellung

## Shop-Konzept

- **Kein Online-Payment** - Bestellung wird per E-Mail an die Kooperative gesendet
- Warenkorb mit localStorage-Persistenz
- Bestellformular mit Kontaktdaten
- Produktkatalog mit Kategorien und Unterkategorien
- Suchfunktion über alle Produkte

## Entscheidungen

| Entscheidung | Gewählt | Begründung |
|-------------|---------|------------|
| Payment | Kein Online-Payment | Bestellung per E-Mail reicht |
| CMS | Payload CMS 3 (standalone) | TypeScript-first, echte DB-Migrations, gutes Seeding |
| Frontend | Astro 5 + Vue 3 | Statische Seiten + interaktive Inseln |
| Seeding | Payload Migrations + Seed-Scripts | Voll versionierbar im Code |
| Hosting | offen | Später entscheiden |
| Design | offen | Funktional starten, Design separat |
