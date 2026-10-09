import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'FrutaCheck QA',
        short_name: 'FrutaCheck',
        description: 'Control de calidad de recepción de fruta',
        lang: 'es',
        theme_color: '#173f5f',
        background_color: '#f4f6f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Las llamadas a Supabase nunca se cachean: los datos siempre vienen del servidor.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
