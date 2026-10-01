<template>
  <div class="min-h-screen pt-24 pb-16 px-4 sm:px-6" style="background-color: var(--koop-orange)">
    <article
      class="max-w-[960px] mx-auto bg-white/95 rounded-2xl shadow-lg px-6 py-10 sm:px-10 sm:py-12 prose"
    >
      <h1 class="text-3xl sm:text-4xl font-bold mb-8">Datenschutzerklärung</h1>

      <section class="mb-6 space-y-3 leading-relaxed">
        <p>
          Für die Kooperative Dürnau hat ein verantwortungsbewusster Umgang mit personenbezogenen
          Daten hohe Priorität. Hier erfahren Sie, welche Daten wir beim Besuch dieser Website und
          bei einer Bestellung verarbeiten, wozu, auf welcher Rechtsgrundlage und wie lange — und
          welche Rechte Sie haben.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Verantwortlicher</h2>
        <p class="leading-relaxed">
          Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne von Art. 4 Nr. 7
          DSGVO ist:
        </p>
        <p class="leading-relaxed mt-2">
          Kooperative Dürnau Verwaltungsgesellschaft mbH<br />
          Im Winkel 11<br />
          88422 Dürnau<br />
          Vertreten durch den Geschäftsführer Rolf Reisiger<br />
          E-Mail:
          <a class="underline hover:text-[#00af8c]" href="mailto:reisiger@kooperative.de"
            >reisiger@kooperative.de</a
          >
        </p>
        <p class="leading-relaxed mt-2">
          Weitere Angaben finden Sie im
          <NuxtLink class="underline hover:text-[#00af8c]" to="/impressum">Impressum</NuxtLink>.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Hosting und Server-Protokolle</h2>
        <p class="leading-relaxed">
          Die Website wird bei MJU-Media in Deutschland gehostet. Bei jedem Aufruf speichert der
          Server in einer Protokolldatei:
        </p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>IP-Adresse des anfragenden Geräts</li>
          <li>Datum und Uhrzeit des Abrufs</li>
          <li>Anfragedetails und Zieladresse</li>
          <li>Name der abgerufenen Datei und übertragene Datenmenge</li>
          <li>Meldung, ob der Abruf erfolgreich war</li>
        </ul>
        <p class="leading-relaxed mt-3">
          Zweck ist der sichere und stabile Betrieb der Website sowie die Abwehr von Angriffen.
          Rechtsgrundlage ist unser berechtigtes Interesse nach Art. 6 Abs. 1 lit. f DSGVO. Die
          Protokolle werden nach Ablauf einer kurzen Frist gelöscht, soweit sie nicht zur Aufklärung
          eines konkreten Sicherheitsvorfalls länger benötigt werden. Eine Auswertung zur
          Profilbildung findet nicht statt.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Cookies und lokale Speicherung</h2>
        <p class="leading-relaxed">
          Wir setzen keine Analyse-, Tracking- oder Werbe-Tools ein und binden keine Inhalte
          externer Anbieter (etwa Schriftarten, Videos oder Karten) ein. Gespeichert wird
          ausschließlich, was für den Shop technisch notwendig ist:
        </p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>
            <strong>Anmelde-Cookie</strong> (<code>koop_session</code>): wird erst gesetzt, wenn Sie
            sich in Ihr Kundenkonto einloggen, und hält Sie bis zu 30 Tage angemeldet. Beim Abmelden
            wird es gelöscht. Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG und Art. 6 Abs. 1 lit. b
            DSGVO.
          </li>
          <li>
            <strong>Bestellliste und Einwilligung</strong> (lokaler Speicher Ihres Browsers,
            <code>kooperative-cart</code> und <code>kooperative-consent-v1</code>): nur nachdem Sie
            im Hinweisfenster zugestimmt haben, damit Ihre Bestellliste beim nächsten Besuch noch da
            ist. Die Daten verlassen Ihr Gerät nicht. Rechtsgrundlage: Ihre Einwilligung nach § 25
            Abs. 1 TDDDG und Art. 6 Abs. 1 lit. a DSGVO.
          </li>
        </ul>
        <ClientOnly>
          <p class="leading-relaxed mt-3" data-testid="consent-state">
            <template v-if="consentGiven">
              Sie haben der Speicherung zugestimmt. Sie können diese Einwilligung jederzeit mit
              Wirkung für die Zukunft widerrufen; Ihre gespeicherte Bestellliste wird dabei von
              Ihrem Gerät gelöscht.
              <button
                type="button"
                class="underline hover:text-[#00af8c]"
                data-testid="consent-revoke"
                @click="revoke"
              >
                Einwilligung widerrufen
              </button>
            </template>
            <template v-else> Derzeit ist keine Einwilligung gespeichert. </template>
          </p>
        </ClientOnly>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Kundenkonto und Bestellungen</h2>
        <p class="leading-relaxed">
          Für ein Kundenkonto und für Bestellungen verarbeiten wir die Angaben, die Sie uns dabei
          machen: Anrede, Name, Anschrift, E-Mail-Adresse, Telefonnummer, Geburtsdatum, Passwort
          (nicht im Klartext gespeichert), die bestellten Artikel, die gewählte Versand- und
          Zahlungsart, eine Bestellnotiz sowie bei Zahlung per Lastschrift Kontoinhaber und IBAN.
          Zur Missbrauchsabwehr protokollieren wir außerdem die IP-Adresse bei Registrierung und
          Anmeldung.
        </p>
        <p class="leading-relaxed mt-3">
          Wir nutzen diese Daten, um Ihr Konto zu führen und Ihre Bestellung abzuwickeln (Art. 6
          Abs. 1 lit. b DSGVO), und um gesetzliche Aufbewahrungspflichten zu erfüllen (Art. 6 Abs. 1
          lit. c DSGVO). Bestätigungen und Rückfragen zu Ihrer Bestellung senden wir Ihnen per
          E-Mail.
        </p>
        <p class="leading-relaxed mt-3">
          Kontodaten speichern wir, bis Sie Ihr Konto löschen lassen. Bestell- und
          Rechnungsunterlagen bewahren wir so lange auf, wie es handels- und steuerrechtlich
          vorgeschrieben ist (in der Regel sechs bzw. zehn Jahre nach § 257 HGB und § 147 AO);
          danach werden sie gelöscht.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Anfragen per E-Mail</h2>
        <p class="leading-relaxed">
          Wenn Sie uns schreiben, verarbeiten wir Ihre Angaben, um Ihre Anfrage zu beantworten (Art.
          6 Abs. 1 lit. b bzw. f DSGVO). Die Korrespondenz bewahren wir auf, solange es für die
          Anfrage nötig ist und gesetzliche Fristen es verlangen.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Weitergabe an Dritte</h2>
        <p class="leading-relaxed">
          Wir geben Ihre Daten nur weiter, soweit es für die Abwicklung Ihrer Bestellung nötig ist
          (etwa an das Versandunternehmen oder zum Einzug einer Lastschrift an unsere Bank), soweit
          wir gesetzlich dazu verpflichtet sind oder soweit es bei Angriffen auf unsere
          Infrastruktur zur Rechtsverfolgung erforderlich ist. Unser Hoster verarbeitet Daten in
          unserem Auftrag nach Art. 28 DSGVO. Eine Übermittlung in Länder außerhalb der EU bzw. des
          EWR findet nicht statt.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Ihre Rechte</h2>
        <p class="leading-relaxed">Sie haben gegenüber uns das Recht auf:</p>
        <ul class="list-disc list-inside mt-2 space-y-1">
          <li>Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>
            Widerspruch gegen Verarbeitungen, die auf unserem berechtigten Interesse beruhen (Art.
            21 DSGVO)
          </li>
          <li>
            Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)
          </li>
        </ul>
        <p class="leading-relaxed mt-3">
          Wenden Sie sich dazu einfach an die oben genannte Adresse. Außerdem können Sie sich bei
          einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel beim
          Landesbeauftragten für den Datenschutz und die Informationsfreiheit Baden-Württemberg.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Pflicht zur Bereitstellung</h2>
        <p class="leading-relaxed">
          Sie sind nicht verpflichtet, uns Daten mitzuteilen. Ohne die für eine Bestellung nötigen
          Angaben können wir diese aber nicht ausführen. Eine automatisierte Entscheidungsfindung
          oder Profilbildung findet nicht statt.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Minderjährigenschutz</h2>
        <p class="leading-relaxed">
          Personen unter 18 Jahren sollten ohne Zustimmung der Eltern oder Erziehungsberechtigten
          keine personenbezogenen Daten an uns übermitteln. Wissentlich erheben wir keine Daten von
          Kindern und Jugendlichen.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Links</h2>
        <p class="leading-relaxed">
          Unser Online-Angebot enthält Links zu Internet-Seiten anderer Anbieter. Erst wenn Sie
          einem solchen Link folgen, erhält der jeweilige Anbieter Ihre Daten; für dessen
          Datenverarbeitung ist er selbst verantwortlich.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold mb-2">Änderungen</h2>
        <p class="leading-relaxed">
          Wenn sich die Website oder die rechtlichen Vorgaben ändern, passen wir diese Erklärung an.
          Stand: Oktober 2026.
        </p>
      </section>
    </article>
  </div>
</template>

<script setup lang="ts">
  const { consentGiven, revoke } = useConsent()

  useHead({
    title: 'Datenschutz – Kooperative Dürnau',
    meta: [{ name: 'description', content: 'Datenschutzerklärung der Kooperative Dürnau.' }],
  })
</script>
