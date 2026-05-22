import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Détection PWA-vs-Electron :
// - En build pour Vercel, on veut une PWA installable avec service worker.
// - En build pour electron-builder (`npm run build`), un service worker
//   n'a pas de sens et risquerait d'intercepter les fetch locaux. On
//   désactive donc le SW si la variable d'env BUILD_TARGET=electron est
//   définie (cf. scripts package.json).
const isElectronBuild = process.env.BUILD_TARGET === 'electron';

export default defineConfig({
  plugins: [
    react(),
    // Le base path '/' est correct pour Vercel ; pour Electron on rebascule
    // en chemins relatifs (cf. `base` plus bas) et on désactive le SW.
    VitePWA({
      disable: isElectronBuild,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Qualidoc V3 — UNITEP',
        short_name: 'Qualidoc V3',
        description: 'Génération automatisée de procédures techniques UNITEP/EDF assistée par IA Mistral.',
        lang: 'fr-FR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#003366',
        background_color: '#F4F6F8',
        icons: [
          { src: 'logo192.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo512.png', sizes: '512x512', type: 'image/png' },
          { src: 'logo512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // On ne met PAS en cache les appels /api/ai/* (IA en temps réel,
        // pas pertinent d'avoir une réponse cachée). Le reste est cachable.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  // Vercel sert depuis `/`, Electron sert depuis le file:// local.
  base: isElectronBuild ? './' : '/',
  root: 'src/renderer',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    target: 'esnext',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@pages': path.resolve(__dirname, 'src/renderer/pages'),
      '@store': path.resolve(__dirname, 'src/renderer/store'),
      '@utils': path.resolve(__dirname, 'src/renderer/utils'),
      '@hooks': path.resolve(__dirname, 'src/renderer/hooks'),
    },
  },
});
