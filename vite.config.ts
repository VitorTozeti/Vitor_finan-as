import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// IMPORTANT: change "base" to match your GitHub repository name
// Example: if your repo is https://github.com/user/greenfinance
// base should be '/greenfinance/'
export default defineConfig({
  base: '/greenfinance/',
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
        start_url: '/greenfinance/',
        scope: '/greenfinance/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/greenfinance/index.html'
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
