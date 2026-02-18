<template>
  <div class="shop">
    <section class="shop-hero">
      <h1>Unser Sortiment</h1>
      <p>Bücher, Papeterie, Medien, Körperpflege, Holzwaren und mehr &mdash; direkt von der Kooperative.</p>
    </section>

    <section class="kategorien-grid">
      <a href="https://shop.kooperative.de/buecher_aktuell.php" target="_blank" rel="noopener" class="kategorie-card">
        <h2>Bücher</h2>
        <p>Kooperative, Andere, Gebrauchte, Kataloge, Karten, Noten</p>
      </a>
      <a href="https://shop.kooperative.de/papeterie_aktuell.php" target="_blank" rel="noopener" class="kategorie-card">
        <h2>Papeterie</h2>
        <p>Notizblöcke, Postkarten, Poster</p>
      </a>
      <a href="https://shop.kooperative.de/medien_aktuell.php" target="_blank" rel="noopener" class="kategorie-card">
        <h2>Medien</h2>
        <p>Texte, Sprache, Filme, Musik</p>
      </a>
      <a href="https://shop.kooperative.de/sonett_aktuell.php" target="_blank" rel="noopener" class="kategorie-card">
        <h2>Sonett</h2>
        <p>Wäsche, Geschirr, Putzmittel</p>
      </a>
      <a href="https://shop.kooperative.de/koerperpflege_aktuell.php" target="_blank" rel="noopener" class="kategorie-card">
        <h2>Körperpflege</h2>
        <p>Gesicht, Haut & Haare, Hand & Fuss, Bad & Dusche</p>
      </a>
      <a href="https://shop.kooperative.de/holz_aktuell.php" target="_blank" rel="noopener" class="kategorie-card">
        <h2>Holz</h2>
        <p>Spiele, Türen, Stühle, Särge</p>
      </a>
      <a href="https://shop.kooperative.de/lebensmittel_aktuell.php" target="_blank" rel="noopener" class="kategorie-card">
        <h2>Lebensmittel</h2>
        <p>Aus der Kooperative</p>
      </a>
      <a href="https://shop.kooperative.de/diverses_aktuell.php" target="_blank" rel="noopener" class="kategorie-card">
        <h2>Diverses</h2>
        <p>Weiteres aus dem Sortiment</p>
      </a>
    </section>

    <section class="shop-info">
      <p>Warenkorb &rarr; Bestellformular &rarr; Versand per E-Mail. Kein Online-Payment.</p>
      <a href="https://shop.kooperative.de/" target="_blank" rel="noopener" class="shop-link">
        Zum Online-Shop &rarr;
      </a>
    </section>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Shop – Kooperative Dürnau',
  meta: [
    {
      name: 'description',
      content: 'Bücher, Papeterie, Medien, Körperpflege, Holzwaren und mehr – direkt von der Kooperative Dürnau.',
    },
  ],
})
</script>

<style scoped>
.shop {
  max-width: 960px;
  margin: 0 auto;
  padding: 6rem 1.5rem 3rem;
}

.shop-hero {
  text-align: center;
  margin-bottom: 2.5rem;
}

.shop-hero h1 {
  font-size: 2rem;
  margin: 0 0 0.75rem;
}

.shop-hero p {
  color: #666;
  font-size: 1.1rem;
  margin: 0;
}

.kategorien-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.kategorie-card {
  display: block;
  padding: 1.5rem;
  background: #f9f9f9;
  border-left: 4px solid #4a7c59;
  border-radius: 6px;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s, background 0.15s;
}

.kategorie-card:hover {
  background: #eef5ee;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.kategorie-card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: #4a7c59;
}

.kategorie-card p {
  margin: 0;
  font-size: 0.85rem;
  color: #888;
}

.shop-info {
  text-align: center;
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e5e5;
}

.shop-info p {
  color: #888;
  font-size: 0.9rem;
  margin: 0 0 1rem;
}

.shop-link {
  display: inline-block;
  padding: 0.6rem 1.5rem;
  background: #4a7c59;
  color: #fff;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 500;
}

.shop-link:hover {
  background: #3d6a4a;
}

@media (max-width: 768px) {
  .shop {
    padding-top: 5rem;
  }

  .shop-hero h1 {
    font-size: 1.5rem;
  }
}
</style>
