/**
 * QA capture sink. `node qa/shotserver.mjs` then POST {name, dataUrl} to :4199.
 *
 * Exists because a browser tab that Chrome has backgrounded renders zero frames,
 * so the only way to look at this game honestly is to drive it with a synthetic
 * clock and pull the canvas out ourselves. Dev tool, never shipped, localhost only.
 */

import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, 'shots')
mkdirSync(OUT, { recursive: true })

createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('shotserver up\n')
    return
  }
  let body = ''
  req.on('data', (c) => {
    body += c
  })
  req.on('end', () => {
    try {
      const { name, dataUrl } = JSON.parse(body)
      const safe = String(name).replace(/[^a-z0-9._-]/gi, '_')
      const b64 = String(dataUrl).split(',')[1] ?? ''
      const file = join(OUT, safe.endsWith('.png') ? safe : `${safe}.png`)
      writeFileSync(file, Buffer.from(b64, 'base64'))
      process.stdout.write(`wrote ${file} (${Math.round(b64.length / 1024)} KB)\n`)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, file }))
    } catch (e) {
      res.writeHead(400)
      res.end(String(e))
    }
  })
}).listen(4199, '127.0.0.1', () => process.stdout.write('shotserver on http://127.0.0.1:4199\n'))
