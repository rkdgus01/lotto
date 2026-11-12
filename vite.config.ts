import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { updateDraws } from './scripts/draws-updater.mjs'

// 개발 서버에서만: 화면의 "지금 업데이트" 버튼이 호출하는 API
function drawsApi(): Plugin {
  let running: Promise<unknown> | null = null
  return {
    name: 'lotto-draws-api',
    configureServer(server) {
      server.middlewares.use('/api/update-draws', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        try {
          running ??= updateDraws().finally(() => (running = null))
          res.end(JSON.stringify({ ok: true, ...(await running as object) }))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  // 상대 경로 — GitHub Pages(https://<계정>.github.io/lotto/)에서도 그대로 동작
  base: './',
  plugins: [react(), drawsApi()],
  // draws.json 이 갱신될 때 페이지 전체가 새로고침되지 않도록
  server: { watch: { ignored: ['**/public/data/**'] } },
})
