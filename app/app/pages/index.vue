<template>
  <div>
    <!-- Hero -->
    <section class="min-h-screen flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat relative" style="background-image: url('/img/hero-produkte.jpg');">
      <div class="absolute inset-0 bg-black/50" />
      <div class="relative z-10 text-center text-white">
        <h1 class="text-5xl font-bold mb-4">Kooperative Dürnau</h1>
        <p class="text-xl mb-2">Leben und Arbeiten in Gemeinschaft seit 1980</p>
        <p class="text-base text-white/80 max-w-xl mx-auto">
          Genossenschaft in Dürnau &mdash; Handwerk, Bildung, Kultur und Vertrieb unter einem Dach.
        </p>
      </div>
    </section>

    <!-- Hauptbereiche -->
    <div class="home">
    <section class="bereiche">
      <h2>Unsere Bereiche</h2>
      <div class="grid">
        <NuxtLink to="/bestellung" class="card card--bestellung">
          <h3>Bestellung</h3>
          <p>Bücher, Papeterie, Medien, Sonett-Produkte, Körperpflege und Holzwaren.</p>
        </NuxtLink>

        <NuxtLink to="/arbeit" class="card card--arbeit">
          <h3>Arbeit</h3>
          <p>Bau, Druckerei, Schreinerei, Gärtnerei Morgengrauen und Allround Dienst Reisiger.</p>
        </NuxtLink>

        <NuxtLink to="/kultur" class="card card--kultur">
          <h3>Kultur</h3>
          <p>Theater, Landwirtschaft, Kulturfond, poinz zero und Veranstaltungen.</p>
        </NuxtLink>

        <NuxtLink to="/bildung" class="card card--bildung">
          <h3>Bildung</h3>
          <p>Sprache, Bienen, Praktika, Dorfuniversität und Veranstaltungen.</p>
        </NuxtLink>

        <NuxtLink to="/gaeste" class="card card--gaeste">
          <h3>Gäste</h3>
          <p>Orientierung, Lernen, Hilfe und Tagesgäste.</p>
        </NuxtLink>
      </div>
    </section>

    <!-- Shop-Vorschau -->
    <section class="shop-vorschau">
      <h2>Unser Sortiment</h2>
      <div class="kategorien">
        <NuxtLink to="/bestellung/buecher" class="kategorie">
          <span class="kategorie-name">Bücher</span>
          <span class="kategorie-detail">Kooperative, Andere, Gebrauchte, Kataloge, Karten, Noten</span>
        </NuxtLink>
        <NuxtLink to="/bestellung/papeterie" class="kategorie">
          <span class="kategorie-name">Papeterie</span>
          <span class="kategorie-detail">Notizblöcke, Postkarten, Poster</span>
        </NuxtLink>
        <NuxtLink to="/bestellung/medien" class="kategorie">
          <span class="kategorie-name">Medien</span>
          <span class="kategorie-detail">Texte, Sprache, Filme, Musik</span>
        </NuxtLink>
        <NuxtLink to="/bestellung/sonett" class="kategorie">
          <span class="kategorie-name">Sonett</span>
          <span class="kategorie-detail">Wäsche, Geschirr, Putzmittel, Körperpflege</span>
        </NuxtLink>
        <NuxtLink to="/bestellung/koerperpflege" class="kategorie">
          <span class="kategorie-name">Körperpflege</span>
          <span class="kategorie-detail">Gesicht, Haut & Haare, Hand & Fuss, Bad & Dusche</span>
        </NuxtLink>
        <NuxtLink to="/bestellung/holz" class="kategorie">
          <span class="kategorie-name">Holz</span>
          <span class="kategorie-detail">Spiele, Türen, Stühle, Särge</span>
        </NuxtLink>
      </div>
    </section>

    <!-- Arbeitsbereiche -->
    <section class="arbeitsbereiche">
      <h2>Arbeitsbereiche</h2>
      <div class="betriebe">
        <div class="betrieb">
          <h3>Bau</h3>
        </div>
        <div class="betrieb">
          <h3>Druckerei</h3>
        </div>
        <div class="betrieb">
          <h3>Schreinerei</h3>
        </div>
        <a href="https://www.gaertnerei-morgengrauen.de/" target="_blank" rel="noopener" class="betrieb betrieb--extern">
          <h3>Gärtnerei Morgengrauen</h3>
          <span class="extern-badge">Externe Website</span>
        </a>
        <div class="betrieb">
          <h3>Allround Dienst Reisiger</h3>
        </div>
      </div>
    </section>

    <!-- Kultur, Bildung, Gäste -->
    <section class="drei-saeulen">
      <div class="saeule">
        <h2>Kultur</h2>
        <ul>
          <li>Veranstaltungen</li>
          <li>Theater</li>
          <li>Landwirtschaft</li>
          <li>Kulturfond</li>
          <li>
            <a href="https://www.ferchervonsteinwand.org/" target="_blank" rel="noopener">
              poinz zero
            </a>
          </li>
        </ul>
      </div>

      <div class="saeule">
        <h2>Bildung</h2>
        <ul>
          <li>Veranstaltungen</li>
          <li>Sprache</li>
          <li>Bienen</li>
          <li>Praktika</li>
          <li>
            <a href="https://www.dorf-uni.de/" target="_blank" rel="noopener">
              Dorfuniversität
            </a>
          </li>
        </ul>
      </div>

      <div class="saeule">
        <h2>Gäste</h2>
        <ul>
          <li>Veranstaltungen</li>
          <li>Orientierung</li>
          <li>Lernen</li>
          <li>Hilfe</li>
          <li>Tagesgäste</li>
        </ul>
      </div>
    </section>

    <!-- Kalender-Hinweis -->
    <section class="kalender">
      <h2>Veranstaltungskalender</h2>
      <p>Alle Veranstaltungen aus Kultur, Bildung und Gästebereich auf einen Blick.</p>
      <NuxtLink to="/kalender" class="kalender-link">Zum Kalender</NuxtLink>
    </section>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Kooperative Dürnau',
  meta: [
    {
      name: 'description',
      content: 'Kooperative Dürnau eG – Leben und Arbeiten in Gemeinschaft seit 1980. Handwerk, Bildung, Kultur und Vertrieb.',
    },
  ],
})
</script>

<style scoped>
.home {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Bereiche Grid */
.bereiche {
  padding: 2.5rem 0;
}

.bereiche h2 {
  margin: 0 0 1.5rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.card {
  display: block;
  padding: 1.5rem;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  text-decoration: none;
  color: inherit;
  border-left: 4px solid #ccc;
  transition: box-shadow 0.15s;
}

.card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.card p {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.card--bestellung { border-left-color: #4a7c59; }
.card--arbeit { border-left-color: #d4a843; }
.card--kultur { border-left-color: #c0392b; }
.card--bildung { border-left-color: #2980b9; }
.card--gaeste { border-left-color: #8e44ad; }

/* Shop-Vorschau */
.shop-vorschau {
  padding: 2.5rem 0;
  border-top: 1px solid #e5e5e5;
}

.shop-vorschau h2 {
  margin: 0 0 1.5rem;
}

.kategorien {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.kategorie {
  display: block;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 6px;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}

.kategorie:hover {
  background: #eef5ee;
}

.kategorie-name {
  display: block;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #4a7c59;
}

.kategorie-detail {
  font-size: 0.8rem;
  color: #888;
}

/* Arbeitsbereiche */
.arbeitsbereiche {
  padding: 2.5rem 0;
  border-top: 1px solid #e5e5e5;
}

.arbeitsbereiche h2 {
  margin: 0 0 1.5rem;
}

.betriebe {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.betrieb {
  padding: 1rem 1.5rem;
  background: #fdf6e3;
  border-radius: 6px;
}

.betrieb h3 {
  margin: 0;
  font-size: 1rem;
}

.betrieb--extern {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.betrieb--extern:hover {
  background: #f5edcf;
}

.extern-badge {
  display: inline-block;
  font-size: 0.7rem;
  color: #888;
  margin-top: 0.25rem;
}

/* Drei Säulen */
.drei-saeulen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  padding: 2.5rem 0;
  border-top: 1px solid #e5e5e5;
}

.saeule h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.saeule ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.saeule li {
  padding: 0.3rem 0;
  font-size: 0.95rem;
  color: #555;
}

.saeule a {
  color: #4a7c59;
  text-decoration: none;
}

.saeule a:hover {
  text-decoration: underline;
}

/* Kalender */
.kalender {
  padding: 2.5rem 0;
  border-top: 1px solid #e5e5e5;
  text-align: center;
  margin-bottom: 2rem;
}

.kalender h2 {
  margin: 0 0 0.5rem;
}

.kalender p {
  color: #666;
  margin: 0 0 1rem;
}

.kalender-link {
  display: inline-block;
  padding: 0.6rem 1.5rem;
  background: #4a7c59;
  color: #fff;
  text-decoration: none;
  border-radius: 4px;
}

.kalender-link:hover {
  background: #3d6a4a;
}
</style>
