import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// O app é servido na raiz pelo Worker da Cloudflare. VITE_BASE só existe para
// publicar numa subpasta (ex.: o antigo GitHub Pages em /Vitor_finan-as/).
const BASE = process.env.VITE_BASE || '/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'GreenFinance',
        short_name: 'GreenFinance',
        description: 'Controle financeiro pessoal e análise de investimentos',
        theme_color: '#080A09',
        background_color: '#080A09',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: `${BASE}index.html`,
        // A API nunca vai para o cache offline nem cai no fallback do SPA.
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
          vendor: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  }
})
