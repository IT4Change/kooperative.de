import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kooperative.de',
  integrations: [
    vue(),
    tailwind(),
    sitemap({
      i18n: { defaultLocale: 'de', locales: { de: 'de-DE' } },
    }),
  ],
  output: 'static',
});
