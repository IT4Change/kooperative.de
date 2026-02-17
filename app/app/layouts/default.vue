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
        <NuxtLink to="/" class="logo">
          <img src="/img/logo.gif" alt="Kooperative Dürnau" class="logo-img" />
        </NuxtLink>

        <nav class="main-nav">
          <NuxtLink to="/#bestellung">Bestellung</NuxtLink>
          <NuxtLink to="/#arbeit">Arbeit</NuxtLink>
          <NuxtLink to="/#kultur">Kultur</NuxtLink>
          <NuxtLink to="/#bildung">Bildung</NuxtLink>
          <NuxtLink to="/#gaeste">Gäste</NuxtLink>
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
const scrolled = ref(false)
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
  flex-wrap: wrap;
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

.header.scrolled .logo-img {
  height: 28px;
}

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

.main-nav a:hover,
.main-nav a.router-link-active {
  border-bottom-color: #4a7c59;
  color: #4a7c59;
}

.main {
  flex: 1;
}

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
</style>
