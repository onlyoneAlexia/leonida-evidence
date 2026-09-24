import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Link previews need absolute image URLs. SITE_URL overrides the production address Netlify (URL) or Vercel provides at build time.
const { env } = process
const site = (env.SITE_URL || env.URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/+$/, '')

// `npm run dev` and `npm run preview` answer /api/leaderboard from memory, through the same handler as the Vercel function.
function localLeaderboard() {
  let board
  // Vite treats a returned function as a post hook, so this must not return the middleware.
  const serve = server => { server.middlewares.use('/api/leaderboard', async (req, res) => {
    const [{ createBoard, handle }, { memoryRedis }] = await Promise.all([import('./api/_leaderboard.js'), import('./api/_memory.js')])
    board ??= createBoard(memoryRedis())
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const request = new Request('http://localhost/api/leaderboard', {
      method: req.method,
      headers: { 'content-type': req.headers['content-type'] ?? '', 'x-forwarded-for': req.socket.remoteAddress ?? '' },
      body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
    })
    const response = await handle(request, board)
    res.statusCode = response.status
    response.headers.forEach((value, name) => res.setHeader(name, value))
    res.end(await response.text())
  }) }
  return { name: 'local-leaderboard', configureServer: serve, configurePreviewServer: serve }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localLeaderboard()],
  // Also fills %SITE_URL% in index.html.
  define: { 'import.meta.env.SITE_URL': JSON.stringify(site) },
  // Ship the licenses of every bundled dependency (React, Unlayer's wrapper) with the site.
  build: { license: { fileName: 'third-party-licenses.txt' } },
})
