// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Specs live next to the code they test, which puts them inside the directories
  // Nitro scans. Without this, server/plugins/*.spec.ts is registered as a plugin
  // (and fails the build for want of a default export), server/middleware/*.spec.ts
  // would run on every request, and every server/api spec would become an endpoint.
  ignore: ['**/*.spec.ts'],
  modules: [
    // tsconfigPath enables type-aware linting, which the it4c TypeScript rules require
    ['@nuxt/eslint', { config: { typescript: { tsconfigPath: 'tsconfig.json' } } }],
    '@nuxt/test-utils/module',
    '@nuxtjs/tailwindcss',
    '@nuxt/image',
  ],
  typescript: {
    // Root-level tool configs are TypeScript too — pull them into the node project
    // so type-aware linting can resolve them (paths are relative to .nuxt/).
    nodeTsConfig: {
      include: [
        '../eslint.config.ts',
        '../prettier.config.ts',
        '../vitest.config.ts',
        '../playwright.config.ts',
      ],
    },
    // Nuxt only picks up test/nuxt/**; our shared test setup lives in test/.
    tsConfig: {
      include: ['../test/**/*', '../e2e/**/*'],
    },
  },
  runtimeConfig: {
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'koop',
      password: process.env.DB_PASSWORD || 'koop',
      database: process.env.DB_DATABASE || 'kooperative',
    },
  },
  image: {
    format: ['avif', 'webp', 'jpg'],
    screens: {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536,
      '2xl': 1920,
    },
  },
  css: ['~/assets/css/main.css'],
  ssr: true,
  routeRules: {
    // Admin is client-rendered so the browser's Basic-Auth credentials are sent
    // with the /admin/api data requests (SSR internal fetch would not carry them),
    // and no admin data is ever embedded in server-rendered HTML.
    '/admin': { ssr: false },
    '/admin/**': { ssr: false },
  },
  nitro: {
    prerender: {
      routes: [],
      crawlLinks: false,
    },
  },
  app: {
    baseURL: '/',
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/img/logo.svg' },
        { rel: 'alternate icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
      script: [
        {
          innerHTML: `(function(){try{window.localStorage.getItem('_')}catch(e){var s={};var f={get length(){return Object.keys(s).length},key:function(i){return Object.keys(s)[i]||null},getItem:function(k){return s[k]===undefined?null:s[k]},setItem:function(k,v){s[k]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}}};Object.defineProperty(window,'localStorage',{value:f,configurable:true,writable:true});window.__storageBlocked=true}})()`,
          type: 'text/javascript',
        },
      ],
    },
  },
})
