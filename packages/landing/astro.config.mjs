import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://system2product.com',
  integrations: [mdx(), sitemap()],
  i18n: {
    defaultLocale: 'tr',
    locales: ['tr', 'en'],
    routing: {
      prefixDefaultLocale: false, // /vizyon (TR), /en/vision (EN)
    },
  },
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
