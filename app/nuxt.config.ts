// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxtjs/tailwindcss', '@nuxt/image'],
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
  ssr: false,
  app: {
    baseURL: '/kooperative.de/',
  },
})