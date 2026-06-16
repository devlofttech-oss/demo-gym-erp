import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import dotenv from 'dotenv'

// Load .env if it exists
if (fs.existsSync('.env')) {
  dotenv.config()
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const API_URL = process.env.VITE_ERP_URL || 'https://erpnext-devloft.m.frappe.cloud'

// API Keys from environment
const API_KEY = process.env.VITE_API_KEY
const API_SECRET = process.env.VITE_API_SECRET

// Serve static React files
app.use(express.static(path.join(__dirname, 'dist')))

// Proxy /api requests to Frappe ERPNext backend
if (API_URL) {
  const proxy = createProxyMiddleware({
    target: API_URL,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq) => {
        if (API_KEY && API_SECRET) {
          proxyReq.setHeader('Authorization', `token ${API_KEY}:${API_SECRET}`)
        }
        // Remove client Expect header to prevent 417 errors
        proxyReq.removeHeader('Expect')
      },
    },
  })

  app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
      return proxy(req, res, next)
    }
    next()
  })
}

// Fallback all other requests to index.html to support React Router
app.use((req, res, next) => {
  // Pass through if the request is for assets or API
  if (req.url.startsWith('/assets/') || req.url.startsWith('/api/')) {
    return next()
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Production server running on port ${PORT}`)
  console.log(`Proxying API requests to ${API_URL}`)
})
