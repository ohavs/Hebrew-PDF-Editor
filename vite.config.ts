import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.GITHUB_PAGES === 'true'
  ? '/Hebrew-PDF-Editor/'
  : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'עורך PDF עברי',
        short_name: 'PDF Editor',
        description: 'עורך PDF מתקדם עם תמיכה מלאה בעברית',
        theme_color: '#1a2332',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('pdfjs-dist')) return 'pdfjs'
          if (id.includes('/fabric/')) return 'fabric'
          if (id.includes('pdf-lib')) return 'pdflib'
          return undefined
        }
      }
    }
  }
})
