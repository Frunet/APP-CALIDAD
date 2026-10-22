import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'logo-frunet.jpg'],
      manifest: {
        name: 'Quality Control',
        short_name: 'Quality Control',
        description: 'Control de calidad de recepción de fruta',
        lang: 'es',
        theme_color: '#123d5a',
        background_color: '#f4f6f8',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
