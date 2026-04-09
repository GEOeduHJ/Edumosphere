import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { URL } from 'url'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        secure: false
      }
    },
    middlewareMode: false,
    hmr: true
  },
  configureServer(server) {
    server.middlewares.use('/__gbproxy', async (req, res, next) => {
      try {
        const urlParam = req.url && req.url.split('?url=')[1]
        if (!urlParam) {
          res.statusCode = 400
          res.end('missing url')
          return
        }
        const target = decodeURIComponent(urlParam)
        const allowed = [/github\.com$/i, /raw\.githubusercontent\.com$/i, /geoboundaries\.org$/i, /rawgit\.com$/i, /cloudfront\.net$/i, /amazonaws\.com$/i]
        let okHost = false
        try {
          const u = new URL(target)
          for (const r of allowed) if (r.test(u.hostname)) { okHost = true; break }
        } catch (e) { okHost = false }
        if (!okHost) {
          res.statusCode = 403
          res.end('forbidden host')
          return
        }

        const fetched = await fetch(target)
        res.statusCode = fetched.status
        const ct = fetched.headers.get('content-type')
        if (ct) res.setHeader('content-type', ct)
        res.setHeader('Access-Control-Allow-Origin', '*')
        const body = await fetched.arrayBuffer()
        res.end(Buffer.from(body))
      } catch (err) {
        res.statusCode = 502
        res.end(String(err || 'proxy error'))
      }
    })
  },
  optimizeDeps: {
    exclude: ['openmeteo']
  }
})
