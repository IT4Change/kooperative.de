<template>
  <div class="layout">
    <header ref="headerRef" class="header" :class="{ scrolled }">
      <div class="header-top">
        <nav class="info-nav">
          <NuxtLink to="/historie">Historie</NuxtLink>
          <NuxtLink to="/kontakt">Kontakt</NuxtLink>
          <NuxtLink to="/impressum">Impressum</NuxtLink>
          <NuxtLink to="/datenschutz">Datenschutz</NuxtLink>
        </nav>
      </div>

      <div class="header-main">
        <NuxtLink to="/" class="logo" :class="{ active: activeSection === 'hero' }">
          <img :src="`${baseURL}img/logo.gif`" alt="Kooperative Dürnau" class="logo-img" />
        </NuxtLink>

        <button class="burger" :class="{ open: menuOpen }" aria-label="Menü" @click="menuOpen = !menuOpen">
          <span /><span /><span />
        </button>

        <nav class="main-nav" :class="{ open: menuOpen }">
          <NuxtLink to="/shop" @click="menuOpen = false">Bestellung</NuxtLink>
          <NuxtLink to="/#arbeit" :class="{ active: activeSection === 'arbeit' }" @click="menuOpen = false">Arbeit</NuxtLink>
          <NuxtLink to="/#kultur" :class="{ active: activeSection === 'kultur' }" @click="menuOpen = false">Kultur</NuxtLink>
          <NuxtLink to="/#bildung" :class="{ active: activeSection === 'bildung' }" @click="menuOpen = false">Bildung</NuxtLink>
          <NuxtLink to="/#gaeste" :class="{ active: activeSection === 'gaeste' }" @click="menuOpen = false">Gäste</NuxtLink>
          <div class="mobile-info-links">
            <NuxtLink to="/historie" @click="menuOpen = false">Historie</NuxtLink>
            <NuxtLink to="/kontakt" @click="menuOpen = false">Kontakt</NuxtLink>
            <NuxtLink to="/impressum" @click="menuOpen = false">Impressum</NuxtLink>
            <NuxtLink to="/datenschutz" @click="menuOpen = false">Datenschutz</NuxtLink>
          </div>
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
const scrolled = ref(false)
const menuOpen = ref(false)
const activeSection = ref('')
const headerRef = ref<HTMLElement>()
let lastScrollY = 0

onMounted(() => {
  const onScroll = () => {
    const currentY = window.scrollY
    const scrollingUp = currentY < lastScrollY

    scrolled.value = !scrollingUp && currentY > 50

    lastScrollY = currentY
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', onScroll))

  const sectionIds = ['hero', 'arbeit', 'kultur', 'bildung', 'gaeste']
  const observer = new IntersectionObserver(
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

  onUnmounted(() => observer.disconnect())
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

.header-top {
  background: rgba(74, 124, 89, 0.9);
  padding: 0.25rem 1.5rem;
  transition: all 0.3s ease;
}

.header.scrolled .header-top {
  max-height: 0;
  padding: 0 1.5rem;
  overflow: hidden;
  opacity: 0;
}

.info-nav {
  display: flex;
  gap: 1.5rem;
  justify-content: flex-end;
}

.info-nav a {
  color: #fff;
  text-decoration: none;
  font-size: 0.8rem;
}

.info-nav a:hover {
  text-decoration: underline;
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
  padding: 0.3rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logo {
  text-decoration: none;
  flex-shrink: 0;
}

.logo-img {
  height: 40px;
  width: auto;
  transition: height 0.3s ease;
}

.logo.active .logo-img {
  height: 48px;
  filter: drop-shadow(0 0 6px rgba(74, 124, 89, 0.6));
}

.header.scrolled .logo-img {
  height: 28px;
}

.header.scrolled .logo.active .logo-img {
  height: 32px;
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
  color: #4a7c59;
}

.main-nav a.active {
  border-bottom-color: #4a7c59;
  color: #4a7c59;
}

.mobile-info-links {
  display: none;
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
  .header-top {
    display: none;
  }

  .burger {
    display: flex;
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

  .mobile-info-links {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 2px solid #4a7c59;
  }

  .mobile-info-links a {
    padding: 0.5rem 0;
    font-size: 0.9rem;
    color: #666;
    border-bottom: none;
  }

  .footer-content {
    flex-direction: column;
    gap: 1.5rem;
  }
}
</style>
