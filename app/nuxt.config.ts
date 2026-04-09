// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxtjs/tailwindcss', '@nuxt/image'],
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
  nitro: {
    prerender: {
      failOnError: false,
      crawlLinks: true,
    },
  },
  app: {
    baseURL: '/kooperative.de/',
  },
})