<template>
  <div class="layout">
    <header class="header">
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
          <strong>Kooperative Dürnau</strong>
        </NuxtLink>

        <nav class="main-nav">
          <NuxtLink to="/bestellung">Bestellung</NuxtLink>
          <NuxtLink to="/arbeit">Arbeit</NuxtLink>
          <NuxtLink to="/kultur">Kultur</NuxtLink>
          <NuxtLink to="/bildung">Bildung</NuxtLink>
          <NuxtLink to="/gaeste">Gäste</NuxtLink>
        </nav>

        <div class="search">
          <input type="search" placeholder="Suchen..." aria-label="Suche" />
        </div>
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

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #333;
}

.header {
  border-bottom: 2px solid #4a7c59;
}

.header-top {
  background: #4a7c59;
  padding: 0.25rem 1.5rem;
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
}

.logo {
  text-decoration: none;
  color: #4a7c59;
  font-size: 1.3rem;
  white-space: nowrap;
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
}

.main-nav a:hover,
.main-nav a.router-link-active {
  border-bottom-color: #4a7c59;
  color: #4a7c59;
}

.search input {
  padding: 0.4rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
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
