import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

// Plugin to handle multi-page HTML files in dev mode
function multiPage(): import('vite').Plugin {
  const pages = ['index.html', 'settings.html', 'overlay.html']
  return {
    name: 'vite-plugin-multi-page',
    transformIndexHtml: {
      enforce: 'pre',
      transform(html, ctx) {
        return html
      },
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] || ''
        const basename = path.basename(url)
        if (pages.includes(basename) && url !== '/' && url !== '/index.html') {
          // Rewrite to the root HTML file path so Vite can find it
          const filePath = path.resolve(__dirname, basename)
          if (fs.existsSync(filePath)) {
            req.url = '/' + basename
          }
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), multiPage()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
        overlay: resolve(__dirname, 'overlay.html'),
      },
    },
  },
})
