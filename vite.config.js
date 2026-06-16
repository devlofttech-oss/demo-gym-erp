import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const erpUrl = env.VITE_ERP_URL || 'https://erpnext-devloft.m.frappe.cloud'
  const apiKey = env.VITE_API_KEY
  const apiSecret = env.VITE_API_SECRET

  return {
    plugins: [react()],
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
              // Inject auth header if API keys are set
              if (apiKey && apiSecret) {
                proxyReq.setHeader('Authorization', `token ${apiKey}:${apiSecret}`)
              }
              // Remove Expect header to prevent 417 errors
              proxyReq.removeHeader('Expect')
            })
          },
        },
      },
    },
  }
})
