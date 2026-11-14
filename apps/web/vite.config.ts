import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline play (FR-12): after the first visit, the app shell, catalog and
    // engine are cached by a service worker so solo missions work without internet.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'GRAVITY: Space Mission Design Game',
        short_name: 'GRAVITY',
        description: 'Design, launch and fly your own space mission.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        start_url: '.',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,jpg}'],
        navigateFallback: 'index.html',
        // The online API and WebSocket are never cached: they must be live.
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
      },
    }),
  ],
  // Read .env from the repo root (one shared file for web + server).
  // Only VITE_* variables are ever exposed to browser code.
  envDir: '../..',
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
