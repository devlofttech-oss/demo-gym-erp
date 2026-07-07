import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import crypto from 'crypto'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const erpUrl = env.VITE_ERP_URL || 'https://erpnext-devloft.m.frappe.cloud'
  const apiKey = env.VITE_API_KEY
  const apiSecret = env.VITE_API_SECRET

  return {
    plugins: [
      react(),
      {
        name: 'imagekit-auth',
        configureServer(server) {
          server.middlewares.use('/api/imagekit-auth', (req, res) => {
            const privateKey = env.IMAGEKIT_PRIVATE_KEY
            if (!privateKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'ImageKit private key not configured' }))
              return
            }
            const token = crypto.randomUUID()
            const expire = Math.floor(Date.now() / 1000) + 2400
            const signature = crypto.createHmac('sha1', privateKey).update(token + expire).digest('hex')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ token, expire, signature }))
          })
        },
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/fast2sms': {
          target: 'https://www.fast2sms.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/fast2sms/, ''),
        },
        '/api': {
          target: erpUrl,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey && apiSecret) {
                proxyReq.setHeader('Authorization', `token ${apiKey}:${apiSecret}`)
              }
              proxyReq.removeHeader('Expect')
            })
          },
        },
      },
    },
  }
})
