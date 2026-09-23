import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Link previews need absolute image URLs. SITE_URL overrides the production address Netlify (URL) or Vercel provides at build time.
const { env } = process
const site = (env.SITE_URL || env.URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/+$/, '')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Also fills %SITE_URL% in index.html.
  define: { 'import.meta.env.SITE_URL': JSON.stringify(site) },
  // Ship the licenses of every bundled dependency (React, Unlayer's wrapper) with the site.
  build: { license: { fileName: 'third-party-licenses.txt' } },
})
