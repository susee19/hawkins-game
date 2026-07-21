// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Hellfire Campaign',
        short_name: 'Hellfire',
        description: 'Escape the Upside Down before Vecna gathers power.',
        theme_color: '#0c0b10',
        background_color: '#0c0b10',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            // You can replace this with any 512x512 icon url or local file
            src: 'https://cdn-icons-png.flaticon.com/512/8364/8364303.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})