import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icons.svg',
        'icons/pwa-192.png',
        'icons/pwa-512.png',
        'icons/apple-touch-180.png',
      ],
      manifest: {
        id: '/',
        name: 'Stonetop',
        short_name: 'Stonetop',
        description: 'Stonetop offline-first character sheets and content grants',
        theme_color: '#17150f',
        background_color: '#17150f',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,json,woff2}'],
        globIgnores: ['**/icons/book*-1024.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
