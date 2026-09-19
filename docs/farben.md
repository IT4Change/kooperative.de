# Farben

Die Palette ist Rudolf Steiners Farbenkreis, und sie lag bereits im Logo. Dieses
Dokument hält fest, welcher Ton wofür da ist, warum er so und nicht anders
aussieht, und welche Kombinationen verboten sind.

Die Werte stehen an zwei Stellen im Code:

| Ort | Wofür |
| --- | --- |
| `app/app/assets/css/main.css` | CSS-Custom-Properties für die `<style scoped>`-Blöcke |
| `app/tailwind.config.ts` | dieselben Werte als Tailwind-Farben für die Utilities |

Doppelt gehalten, weil Tailwind 3 den `/opacity`-Modifier (`bg-koop-blue/10`,
für die getönten Chips) nur aus einem echten Farbwert rechnen kann, nicht aus
einer Custom Property. Wer einen Wert ändert, ändert ihn an beiden Stellen.

## Herkunft: das Logo ist der Farbenkreis

`app/public/img/logo.svg` enthält vier reine Farben plus Verläufe dazwischen:

| Im Logo | Bei Steiner |
| --- | --- |
| `#FFD200` Gelb | Glanzfarbe — Glanz des Geistes |
| `#C9253E` Rot | Glanzfarbe — Glanz des Lebendigen |
| `#003C7B` Blau | Glanzfarbe — Glanz der Seele |
| `#008748` Grün | Bildfarbe — das tote Bild des Lebendigen |
| `#702F00` Braun | Kontur des Schriftzugs, dient als Tinte |

Steiner unterscheidet in **GA 291 „Das Wesen der Farben"** (drei Vorträge,
Dornach, 6.–8. Mai 1921) zwischen *Glanzfarben*, die ein Wesen von außen zeigen,
und *Bildfarben*, die etwas abbilden statt zu leuchten. Die vier Bildfarben in
seiner Formel: „Schwarz: das geistige Bild des Toten, Grün: das tote Bild des
Lebens, Pfirsichblüt: das lebendige Bild der Seele, Weiß: das seelische Bild des
Geistes."

Gelb, Rot und Blau im Logo sind exakt die drei Glanzfarben. Die Palette musste
deshalb nicht erfunden werden — sie musste nur benannt und auf WCAG geprüft
werden.

## Die Tabelle

| Rolle | Token | Hex | Steiner | Kontrast |
| --- | --- | --- | --- | --- |
| Grund | `--koop-peach-blossom` | `#E4C9C7` | Bildfarbe, lebendiges Bild der Seele | Träger, nie Textfarbe |
| Handlung | `--koop-red` | `#C9253E` | Glanz des Lebendigen | weiß darauf 5,50:1 |
| | `--koop-red-hover` | `#B02036` | | weiß darauf 7,05:1 |
| | `--koop-red-active` | `#961B2E` | | nur Tiefenkante, kein Text |
| Orientierung | `--koop-blue` | `#003C7B` | Glanz der Seele | weiß darauf 10,87:1 · als Text 10,87 (weiß) / 6,97 (Grund) |
| | `--koop-blue-hover` | `#00336A` | | weiß darauf 12,52:1 |
| | `--koop-blue-active` | `#002A58` | | Admin-Sidebar-Fläche |
| Bestätigung | `--koop-green` | `#008748` | Bildfarbe, ruhende Fläche | weiß darauf 4,61:1 |
| | `--koop-green-hover` | `#00743D` | | weiß darauf 5,97:1 |
| | `--koop-green-active` | `#006234` | | nur Tiefenkante |
| Hinweis | `--koop-yellow` | `#FFD200` | Glanz des Geistes | Tinte darauf 9,45:1 |
| | `--koop-yellow-hover` | `#F2C800` | | |
| | `--koop-yellow-active` | `#E0B900` | | |
| Text | `--koop-ink` | `#3A2A20` | aus dem Logo-Braun | 13,71 (weiß) / 8,80 (Grund) |
| Text, gedämpft | `--koop-ink-muted` | `#6B5044` | | 7,35 (weiß) / 4,72 (Grund) |
| Text auf Dunkel | `--koop-ink-inverse` | `#C9AAA4` | vertieftes Inkarnat | 6,64 (Sidebar) / 6,38 (Footer) |
| Zierlinie, Logo-Ton | `--koop-brown` | `#702F00` | | 10,02 (weiß) / 6,43 (Grund) |

Alle Werte gegen WCAG 2.1 AA gerechnet, Schwelle 4,5:1 für normalen Text.

## Regeln

Drei Dinge sind keine Geschmacksfrage, sondern fallen sonst durch:

1. **Gelb trägt nie weißen Text.** Weiß auf `#FFD200` sind 1,45:1. Die Variante
   `koop-btn--yellow` setzt deshalb `--btn-label` auf `--koop-ink`.
2. **Rot und Grün sind Flächen, keine Textfarben auf dem Grund.** Rot auf
   Pfirsichblüt sind 3,53:1, Grün 2,96:1. Als Fläche mit weißer Schrift sind
   beide in Ordnung, als Text auf der Tapete nicht.
3. **Blau ist der einzige Ton, der überall geht** — auf Weiß, auf dem Grund, und
   als Fläche mit weißer Schrift. Deshalb trägt es Links, Navigation und Fokus.

Ein Screen hat **eine** Haupthandlung, und die ist rot. Alles andere ist blau.
Wird alles rot, schreit die Oberfläche und die Hierarchie ist weg.

## Pfirsichblüt als Grund

Pfirsichblüt — bei Steiner auch *Inkarnat*, die Farbe durchbluteter Haut — ist
„das lebendige Bild der Seele" und damit kein Akzent, sondern der Boden, auf dem
alles steht. Im Farbenkreis liegt es dem Grün gegenüber (Goethes Purpur) und
kommt im normalen Spektrum gar nicht vor, nur im Komplementärspektrum.

Umgesetzt ist es als gekachelte Tapete, `app/public/img/bg-peach-blossom.jpg`
(107 × 154 px, 4,4 KB), montiert auf `.layout` in `app/app/layouts/default.vue`.
Inhalte liegen als helle Tafeln darauf — dieselbe Anordnung wie auf der alten
Website.

### Warum eine Textur und keine Fläche

Steiner beschreibt die Entstehung des Inkarnats als Ineinanderwellen von Schwarz
und Weiß, „von rotem Schein durchstrahlt", mit „einer starken Tendenz sich zu
verflüchtigen". In der anthroposophischen Praxis entsteht die Farbe deshalb
durch **Lasurmalerei**: mehrere transparente Schichten, deren Ton mit Schichtzahl,
Untergrund und Licht wandert. Eine glatte Volltonfläche widerspricht dem. Die
Kachel mit sichtbarer Pinselstruktur ist die Bildschirm-Entsprechung zur Lasur.

Aus demselben Grund gibt es keinen kanonischen RGB-Wert für Pfirsichblüt.
`#E4C9C7` ist der Mittelwert unserer Kachel, kein Normwert.

### Woher die Kachel kommt

Es ist die Originalkachel der alten Website
(`old/ftp-data/web/jpeg/koop_background_rot.jpg`), nur umgefärbt. Die
Pinselstruktur ist unverändert.

| | Farbton | Sättigung | Helligkeit | Mittelwert |
| --- | --- | --- | --- | --- |
| alt | 24° | 96 % | 66 % | `#FB9957` |
| neu | 4° | 35 % | 84 % | `#E4C9C7` |

Die alte Kachel war also ein kräftiges Orange, kein Inkarnat. Die Erklärung
liegt vermutlich in der Entstehungszeit: `#FB9957` liegt innerhalb des
JPEG-Rauschens auf `#FF9966` der 216-Farben-Websafe-Palette, und das alte HTML
setzte dazu `bgcolor="#ffa677"`. Die 90er-Palette gab schlicht nichts Zarteres
her. Diese Beschränkung gibt es heute nicht mehr.

Die beiden anderen Kacheln der alten Seite passen ins selbe Bild:
`koop_background_gruen.jpg` (`#A1D59D`, websafe `#99CC99`) und
`koop_background_gelb_01.jpg` (`#EBDA52`, websafe `#FFCC66`) — Grün als
Bildfarbe, Gelb als Glanzfarbe.

## Was axe nicht messen kann

Die axe-Baseline (`app/e2e/a11y-baseline.json`, siehe
[testing.md](testing.md)) ist leer — keine Ansicht meldet einen Verstoß. Zwei
blinde Flecken bleiben trotzdem, und für beide gilt: **von Hand rechnen, nicht
auf axe verlassen.**

**Hintergrundbilder.** Sobald ein Element ein `background-image` im
Hintergrund-Stack hat, verschiebt axe `color-contrast` von `violations` nach
`incomplete` — und `incomplete` prüft die Baseline nicht. Auf jeder Seite mit der
Tapete ist die Kontrastprüfung damit ausgeschaltet. Das lässt sich nicht
umgehen; ein CSS-Gradient oder ein separater Layer blenden die Regel genauso.
Deshalb stehen die Kontrastwerte gegen den Grund oben in der Tabelle.

**Pseudo-Element-Flächen.** `KoopButton` malt seine Fläche mit `::after`. axe
meldet „background color could not be determined due to a pseudo element" und
sieht die Beschriftung nie. Die Werte:

| Variante | Fläche | Hover |
| --- | --- | --- |
| rot (Standard) | 5,50:1 | 7,05:1 |
| blau | 10,87:1 | 12,52:1 |
| grün | 4,61:1 | 5,97:1 |
| gelb (mit Tinte) | 9,45:1 | 8,51:1 |

Wer eine Variante hinzufügt, rechnet den Wert selbst nach und schreibt ihn in
den Kommentar daneben.
