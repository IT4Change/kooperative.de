<template>
  <div class="layout">
    <header ref="headerRef" class="header" :class="{ scrolled }">
      <div class="header-main">
        <NuxtLink to="/" class="logo" :class="{ active: activeSection === 'hero' }" @click.prevent="scrollToTop">
          <img :src="`${baseURL}img/logo.svg`" alt="Kooperative Dürnau" class="logo-img" />
          <span class="logo-text">Kooperative Dürnau</span>
        </NuxtLink>

        <button class="burger" :class="{ open: menuOpen }" aria-label="Menü" @click="menuOpen = !menuOpen">
          <span /><span /><span />
        </button>

        <nav class="main-nav" :class="{ open: menuOpen }">
          <NuxtLink to="/shop" :class="{ active: isShopActive }" @click="menuOpen = false">Bestellung</NuxtLink>
          <NuxtLink to="/#arbeit" :class="{ active: activeSection === 'arbeit' }" @click="menuOpen = false">Arbeit</NuxtLink>
          <NuxtLink to="/#kultur" :class="{ active: activeSection === 'kultur' }" @click="menuOpen = false">Kultur</NuxtLink>
          <NuxtLink to="/#bildung" :class="{ active: activeSection === 'bildung' }" @click="menuOpen = false">Bildung</NuxtLink>
          <NuxtLink to="/#gaeste" :class="{ active: activeSection === 'gaeste' }" @click="menuOpen = false">Gäste</NuxtLink>
          <span class="nav-spacer" />
          <NuxtLink to="/historie" class="info-link" @click="menuOpen = false">Historie</NuxtLink>
          <NuxtLink to="/kontakt" class="info-link" @click="menuOpen = false">Kontakt</NuxtLink>
          <NuxtLink to="/impressum" class="info-link" @click="menuOpen = false">Impressum</NuxtLink>
          <NuxtLink to="/datenschutz" class="info-link" @click="menuOpen = false">Datenschutz</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="main">
      <slot />
    </main>

    <footer class="footer">
      <div class="footer-content">
        <div class="footer-section">
          <strong>Kooperative Dürnau eG</strong>
          <p>Leben und Arbeiten in Gemeinschaft seit 1980</p>
        </div>
        <div class="footer-section">
          <strong>Kontakt</strong>
          <nav>
            <NuxtLink to="/kontakt">Kontakt aufnehmen</NuxtLink>
            <NuxtLink to="/impressum">Impressum</NuxtLink>
            <NuxtLink to="/datenschutz">Datenschutz</NuxtLink>
          </nav>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { baseURL } = useRuntimeConfig().app
const route = useRoute()
const scrolled = ref(false)
const menuOpen = ref(false)
const activeSection = ref('')
const headerRef = ref<HTMLElement>()
let lastScrollY = 0

const router = useRouter()
const isShopActive = computed(() => route.path.startsWith('/shop'))

function scrollToTop() {
  if (route.path === '/') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    router.push('/')
  }
}

const sectionIds = ['hero', 'arbeit', 'kultur', 'bildung', 'gaeste']
let observer: IntersectionObserver | null = null

function observeSections() {
  if (observer) observer.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeSection.value = entry.target.id
        }
      }
    },
    { threshold: 0.4 },
  )
  for (const id of sectionIds) {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  }
}

watch(() => route.fullPath, () => {
  if (route.path === '/') {
    nextTick(() => observeSections())
  } else {
    activeSection.value = ''
  }
})

onMounted(() => {
  const onScroll = () => {
    const currentY = window.scrollY
    const scrollingUp = currentY < lastScrollY

    scrolled.value = !scrollingUp && currentY > 50

    lastScrollY = currentY
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    observer?.disconnect()
  })

  if (route.path === '/') observeSections()
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #333;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  transition: all 0.3s ease;
}

.nav-spacer {
  flex: 1;
}

.info-link {
  font-size: 0.8rem !important;
  color: #888 !important;
  font-weight: 400 !important;
}

.info-link:hover {
  color: #00af8c !important;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
}

.header.scrolled .header-main {
  gap: 1rem;
  padding: 0.3rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logo {
  text-decoration: none;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-text {
  font-weight: 600;
  font-size: 1.1rem;
  color: #333;
  white-space: nowrap;
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  transition: max-width 0.4s ease, opacity 0.3s ease;
}

.logo-img {
  height: 40px;
  width: auto;
  transition: height 0.3s ease;
}

.header.scrolled .logo-img {
  height: 28px;
}

/* Burger Button */
.burger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-left: auto;
}

.burger span {
  display: block;
  width: 24px;
  height: 2px;
  background: #333;
  transition: all 0.3s ease;
  transform-origin: center;
}

.burger.open span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.burger.open span:nth-child(2) {
  opacity: 0;
}

.burger.open span:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

/* Desktop Nav */
.main-nav {
  display: flex;
  gap: 1.5rem;
  flex: 1;
}

.main-nav a {
  color: #333;
  text-decoration: none;
  font-weight: 500;
  padding: 0.25rem 0;
  border-bottom: 2px solid transparent;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.header.scrolled .main-nav a {
  font-size: 0.9rem;
}

.main-nav a:hover {
  color: #00af8c;
}

.main-nav a.active {
  border-bottom-color: #00af8c;
  color: #00af8c;
}

/* Main */
.main {
  flex: 1;
}

/* Footer */
.footer {
  background: #333;
  color: #ddd;
  padding: 2rem 1.5rem;
  margin-top: auto;
}

.footer-content {
  display: flex;
  gap: 3rem;
  flex-wrap: wrap;
  max-width: 960px;
  margin: 0 auto;
}

.footer-section nav {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.footer-section a {
  color: #aaa;
  text-decoration: none;
  font-size: 0.9rem;
}

.footer-section a:hover {
  color: #fff;
}

.footer-section p {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
  color: #aaa;
}

/* Mobile */
@media (max-width: 768px) {
  .burger {
    display: flex;
  }

  .logo-text {
    display: inline-block;
    max-width: 200px;
    opacity: 1;
  }

  .nav-spacer {
    border-top: 2px solid #00af8c;
    margin-top: 0.5rem;
    padding-top: 0.25rem;
  }

  .main-nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(8px);
    padding: 1rem 1.5rem 1.5rem;
    gap: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .main-nav.open {
    display: flex;
  }

  .main-nav a {
    padding: 0.75rem 0;
    font-size: 1.1rem;
    border-bottom: 1px solid #eee;
  }

  .main-nav a:last-of-type {
    border-bottom: none;
  }

  .info-link {
    font-size: 0.9rem !important;
    color: #666 !important;
    border-bottom: none !important;
    padding: 0.5rem 0 !important;
  }

  .footer-content {
    flex-direction: column;
    gap: 1.5rem;
  }
}
</style>
