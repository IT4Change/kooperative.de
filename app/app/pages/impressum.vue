<template>
  <div class="min-h-screen pt-24 pb-16 px-4 sm:px-6" style="background-color: var(--koop-orange);">
  <article class="max-w-[960px] mx-auto bg-white/95 rounded-2xl shadow-lg px-6 py-10 sm:px-10 sm:py-12 prose">
    <h1 class="text-3xl sm:text-4xl font-bold mb-8">Impressum</h1>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-3">Inhaberin der Website</h2>
      <p class="leading-relaxed">
        Kooperative Dürnau Verwaltungsgesellschaft mbH<br>
        Im Winkel 11<br>
        88422 Dürnau
      </p>
      <dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
        <dt class="font-semibold">Geschäftsführer</dt>
        <dd>Rolf Reisiger</dd>
        <dt class="font-semibold">Registergericht</dt>
        <dd>Amtsgericht Ulm, HRB 650133</dd>
        <dt class="font-semibold">Kontakt</dt>
        <dd><a class="underline hover:text-[#00af8c]" href="mailto:reisiger@kooperative.de">reisiger@kooperative.de</a></dd>
      </dl>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-3">Haftung</h2>

      <h3 class="font-semibold mt-4 mb-1">Inhalte</h3>
      <p class="leading-relaxed">
        Diese Website wurde mit Sorgfalt erstellt und geprüft. Für die Aktualität, Vollständigkeit und Funktion kann dennoch keine Gewähr gegeben werden. Sollten Rechte verletzt werden, wird der entsprechende Inhalt entfernt.
      </p>

      <h3 class="font-semibold mt-4 mb-1">Links</h3>
      <p class="leading-relaxed">
        Die verwendeten externen Links verweisen auf Webseiten oder Teile von Webseiten Dritter. Rechtsverstöße auf diesen Seiten waren zum Zeitpunkt der Verlinkung nicht bekannt. Eine Haftung für Qualität und Inhalt dieser Seiten kann nicht übernommen werden.
      </p>

      <h3 class="font-semibold mt-4 mb-1">Hosting</h3>
      <p class="leading-relaxed">
        Die Seite wird von der Kooperative Dürnau gewartet und bei MJU-Media gehostet. Bei technischen Fragen und Problemen wenden Sie sich bitte an <a class="underline hover:text-[#00af8c]" href="mailto:reisiger@kooperative.de">reisiger@kooperative.de</a>.
      </p>
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-3">Erklärung</h2>
      <p class="leading-relaxed">
        Alle Verweise von dieser Seite sind bei ihrer Einrichtung geprüft worden. Veränderte Seiten oder deren Inhalte liegen in der Verantwortung der jeweiligen Seitenbetreiber. Vermutete Verstöße gegen geltendes Recht und Sitten bitten wir ebenso anzuzeigen wie jede andere Funktionsstörung dieser Seite:
        <a class="underline hover:text-[#00af8c]" href="mailto:reisiger@kooperative.de?subject=Beschwerde">Nachricht senden</a>.
      </p>
    </section>
  </article>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'Impressum – Kooperative Dürnau',
  meta: [
    { name: 'description', content: 'Impressum der Kooperative Dürnau Verwaltungsgesellschaft mbH.' },
  ],
})
</script>
