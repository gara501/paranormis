
// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  vite: {
     optimizeDeps: {
       // maplibre-gl ships its own web worker bundle; Vite's dependency
       // optimizer mishandles it, causing "file does not exist ...
       // maplibre-gl-worker.mjs" and a blank basemap. Excluding it from
       // pre-bundling lets the browser load it as-is.
       exclude: ['maplibre-gl'],
     },
   },
});
