import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import tailwind from '@astrojs/tailwind';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  integrations: [
    react(),
    tailwind(),
    netlify({
      edgeMiddleware: true
    })
  ],
  output: 'server',
  adapter: netlify(),
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  },
  // Remove i18n config since we're handling language switching client-side
  // This prevents Astro from creating /ru routes that don't exist
});