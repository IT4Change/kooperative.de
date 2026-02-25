<template>
  <div>
    <!-- Hero -->
    <section id="hero" class="h-screen flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat relative" :style="{ backgroundImage: `url('${baseURL}img/hero.jpg')` }">
      <div class="absolute inset-0 bg-black/50" />
      <div class="relative z-10 text-center text-white drop-shadow-lg">
        <h1 class="text-3xl md:text-5xl font-bold mb-4 px-4 [text-shadow:_0_2px_8px_rgba(0,0,0,0.5)]">Kooperative Dürnau</h1>
        <p class="text-lg md:text-xl mb-2 px-4 [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">Leben und Arbeiten in Gemeinschaft seit 1980</p>
        <p class="text-sm md:text-base text-white/80 max-w-xl mx-auto px-4 [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
          Genossenschaft in Dürnau &mdash; Handwerk, Bildung, Kultur und Vertrieb unter einem Dach.
        </p>
        <div class="flex items-center justify-center gap-3 md:gap-4 mt-6 md:mt-8">
          <a href="#arbeit" @click.prevent="scrollToArbeit" class="px-6 md:px-8 py-2.5 md:py-3 border-2 border-white text-white hover:bg-white/20 font-semibold rounded-lg text-base md:text-lg transition cursor-pointer">
            Zur Kooperative
          </a>
          <NuxtLink to="/shop" class="px-6 md:px-8 py-2.5 md:py-3 bg-[#4a7c59] hover:bg-[#3d6a4a] text-white font-semibold rounded-lg text-base md:text-lg transition">
            Bestellung
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Arbeit -->
    <section id="arbeit" class="min-h-screen md:h-screen flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat relative overflow-hidden py-20 md:py-0" :style="{ backgroundImage: `url('${baseURL}img/sections/arbeit.jpg')` }">
      <div class="absolute inset-0 bg-black/40" />
      <div class="relative z-10 text-center text-white max-w-3xl px-4 md:px-6 [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
        <h2 class="text-2xl md:text-4xl font-bold mb-4 [text-shadow:_0_2px_8px_rgba(0,0,0,0.5)]">Arbeitsbereiche</h2>
        <p class="text-base md:text-lg mb-6 md:mb-10 text-white/80">Handwerk, Bau und Gartenbau &mdash; die Betriebe der Kooperative.</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Bau</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Druckerei</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Schreinerei</span>
          </div>
          <a href="https://www.gaertnerei-morgengrauen.de/" target="_blank" rel="noopener" class="bg-black/30 hover:bg-black/40 backdrop-blur-sm rounded-lg p-3 md:p-5 transition">
            <span class="block text-base md:text-xl font-semibold mb-1">Gärtnerei Morgengrauen</span>
            <span class="text-xs md:text-sm text-white/70">Externe Website &rarr;</span>
          </a>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Allround Dienst Reisiger</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Kultur -->
    <section id="kultur" class="min-h-screen md:h-screen flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat relative overflow-hidden py-20 md:py-0" :style="{ backgroundImage: `url('${baseURL}img/sections/kultur.jpg')` }">
      <div class="absolute inset-0 bg-black/40" />
      <div class="relative z-10 text-center text-white max-w-3xl px-4 md:px-6 [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
        <h2 class="text-2xl md:text-4xl font-bold mb-4 [text-shadow:_0_2px_8px_rgba(0,0,0,0.5)]">Kultur</h2>
        <p class="text-base md:text-lg mb-6 md:mb-10 text-white/80">Theater, Landwirtschaft, Kunst und Veranstaltungen in Dürnau.</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Veranstaltungen</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Theater</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Landwirtschaft</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Kulturfond</span>
          </div>
          <a href="https://www.ferchervonsteinwand.org/" target="_blank" rel="noopener" class="bg-black/30 hover:bg-black/40 backdrop-blur-sm rounded-lg p-3 md:p-5 transition">
            <span class="block text-base md:text-xl font-semibold mb-1">poinz zero</span>
            <span class="text-xs md:text-sm text-white/70">Fercher von Steinwand e.V. &rarr;</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Bildung -->
    <section id="bildung" class="min-h-screen md:h-screen flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat relative overflow-hidden py-20 md:py-0" :style="{ backgroundImage: `url('${baseURL}img/sections/bildung.jpg')` }">
      <div class="absolute inset-0 bg-black/40" />
      <div class="relative z-10 text-center text-white max-w-3xl px-4 md:px-6 [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
        <h2 class="text-2xl md:text-4xl font-bold mb-4 [text-shadow:_0_2px_8px_rgba(0,0,0,0.5)]">Bildung</h2>
        <p class="text-base md:text-lg mb-6 md:mb-10 text-white/80">Sprache, Natur, Praktika und die Dorfuniversität &mdash; Lernen in Dürnau.</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Veranstaltungen</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Sprache</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Bienen</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Praktika</span>
          </div>
          <a href="https://www.dorf-uni.de/" target="_blank" rel="noopener" class="bg-black/30 hover:bg-black/40 backdrop-blur-sm rounded-lg p-3 md:p-5 transition">
            <span class="block text-base md:text-xl font-semibold mb-1">Dorfuniversität</span>
            <span class="text-xs md:text-sm text-white/70">dorf-uni.de &rarr;</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Gäste -->
    <section id="gaeste" class="min-h-screen md:h-screen flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat relative overflow-hidden py-20 md:py-0" :style="{ backgroundImage: `url('${baseURL}img/sections/gaeste.jpg')` }">
      <div class="absolute inset-0 bg-black/40" />
      <div class="relative z-10 text-center text-white max-w-3xl px-4 md:px-6 [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
        <h2 class="text-2xl md:text-4xl font-bold mb-4 [text-shadow:_0_2px_8px_rgba(0,0,0,0.5)]">Gäste</h2>
        <p class="text-base md:text-lg mb-6 md:mb-10 text-white/80">Willkommen in Dürnau &mdash; Orientierung, Lernen und Hilfe für Besuchende.</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Veranstaltungen</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Orientierung</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Lernen</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Hilfe</span>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-lg p-5">
            <span class="block text-base md:text-xl font-semibold mb-1">Tagesgäste</span>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
const { baseURL } = useRuntimeConfig().app

useHead({
  title: 'Kooperative Dürnau',
  meta: [
    {
      name: 'description',
      content: 'Kooperative Dürnau eG – Leben und Arbeiten in Gemeinschaft seit 1980. Handwerk, Bildung, Kultur und Vertrieb.',
    },
  ],
})

function scrollToArbeit() {
  document.getElementById('arbeit')?.scrollIntoView({ behavior: 'smooth' })
}

const sectionIds = ['', 'arbeit', 'kultur', 'bildung', 'gaeste']
let isScrolling = false

function getSections(): HTMLElement[] {
  return sectionIds
    .map((id) => id ? document.getElementById(id) : document.querySelector('section'))
    .filter((el): el is HTMLElement => el !== null)
}

function getTargetSection(direction: 'down' | 'up'): HTMLElement | null {
  const sections = getSections()
  const scrollY = window.scrollY
  const threshold = 20

  if (direction === 'down') {
    for (const section of sections) {
      if (section.offsetTop > scrollY + threshold) {
        return section
      }
    }
  } else {
    // Beim Hochscrollen: nur zur Startseite (erste Sektion) einrasten
    const hero = sections[0]
    if (hero && scrollY > threshold && scrollY < hero.offsetHeight) {
      return hero
    }
  }
  return null
}

function onWheel(e: WheelEvent) {
  if (isScrolling) return

  const direction = e.deltaY > 0 ? 'down' : 'up'

  if (direction === 'up') {
    const hero = getSections()[0]
    if (!hero) return
    const scrollY = window.scrollY
    if (scrollY > 0 && scrollY <= hero.offsetHeight) {
      e.preventDefault()
      isScrolling = true
      hero.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => { isScrolling = false }, 800)
    }
    return
  }

  const next = getTargetSection('down')
  if (!next) return

  const scrollY = window.scrollY
  const lastSection = getSections().at(-1)
  if (lastSection && scrollY >= lastSection.offsetTop + lastSection.offsetHeight - window.innerHeight) return

  e.preventDefault()
  isScrolling = true

  next.scrollIntoView({ behavior: 'smooth' })

  setTimeout(() => {
    isScrolling = false
  }, 800)
}

let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY
}

function onTouchMove(e: TouchEvent) {
  if (isScrolling) return
  const deltaY = touchStartY - e.touches[0].clientY

  // Swipe nach unten (Inhalt nach oben) → zur Hero snappen
  if (deltaY < -30) {
    const hero = getSections()[0]
    if (!hero) return
    const scrollY = window.scrollY
    if (scrollY > 0 && scrollY <= hero.offsetHeight) {
      e.preventDefault()
      isScrolling = true
      hero.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => { isScrolling = false }, 800)
    }
    return
  }

  if (deltaY <= 30) return

  const next = getTargetSection('down')
  if (!next) return

  const scrollY = window.scrollY
  const lastSection = getSections().at(-1)
  if (lastSection && scrollY >= lastSection.offsetTop + lastSection.offsetHeight - window.innerHeight) return

  e.preventDefault()
  isScrolling = true

  next.scrollIntoView({ behavior: 'smooth' })

  setTimeout(() => {
    isScrolling = false
  }, 800)
}

onMounted(() => {
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
})

onUnmounted(() => {
  window.removeEventListener('wheel', onWheel)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
})
</script>

