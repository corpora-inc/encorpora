#!/usr/bin/env node
/**
 * topo-render.mjs — boots a fresh vite (WebKit) and renders several GENERATED
 * topologies through the REAL stylized world look (composition.ts unchanged),
 * screenshotting a top-down + a hero angle of each into /tmp/wp-topo-*.png so a
 * human can confirm they're walkable + look designed.
 *
 *   Run:  node qa/topo-render.mjs
 *   Env:  WP_TOPO_REUSE=1  WP_TOPO_BASE=http://localhost:PORT
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = Number(process.env.WP_TOPO_PORT ?? 5185)
const BASE = process.env.WP_TOPO_BASE ?? `http://localhost:${PORT}`
const REUSE = process.env.WP_TOPO_REUSE === "1"

const procs = []
const spawnProc = (cmd, args, name) => {
  const p = spawn(cmd, args, { cwd: packDir, stdio: "pipe", detached: true })
  p.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`))
  p.stderr.on("data", (d) => process.stderr.write(`[${name}] ${d}`))
  procs.push(p)
  return p
}
const portOpen = (port) =>
  new Promise((res) => {
    let pending = 2
    let opened = false
    const done = (ok) => {
      if (ok) opened = true
      if (--pending === 0) res(opened)
    }
    for (const host of ["127.0.0.1", "::1"]) {
      const s = net.connect(port, host)
      s.once("connect", () => {
        s.destroy()
        done(true)
      })
      s.once("error", () => done(false))
    }
  })
const waitPort = async (port, label, timeoutMs = 30000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(port)) return true
    await sleep(300)
  }
  throw new Error(`timed out waiting for ${label} on :${port}`)
}
const cleanup = () => {
  for (const p of procs) {
    try {
      process.kill(-p.pid, "SIGKILL")
    } catch {}
    try {
      p.kill("SIGKILL")
    } catch {}
  }
}
process.on("exit", cleanup)
process.on("SIGINT", () => {
  cleanup()
  process.exit(1)
})

const ARCHETYPES = ["grand-plaza", "harbor", "walled-town", "market-square", "garden-court"]

async function main() {
  if (!REUSE) {
    spawnProc("npx", ["vite", "--port", String(PORT), "--strictPort"], "vite")
    await waitPort(PORT, "vite")
    await sleep(800)
  }
  const browser = await webkit.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 })
  page.on("console", (m) => {
    const t = m.text()
    if (t.includes("[wp/topo]") || t.toLowerCase().includes("error")) console.log("  [page]", t)
  })

  let failures = 0
  for (const arch of ARCHETYPES) {
    const url = `${BASE}/qa/topo-render.html?archetype=${arch}&seed=1770`
    await page.goto(url, { waitUntil: "load" })
    // wait for the mount to expose its hooks (engine booted + look built).
    try {
      await page.waitForFunction(() => window.__wpTopo && window.__wpTopo.ready === true, {
        timeout: 25000,
      })
    } catch {
      console.log(`  x ${arch}: mount never became ready`)
      failures++
      continue
    }
    await sleep(1200) // let dressing/buildings/atmosphere settle

    for (const [shot, hook] of [
      ["top", "setTopDownWide"],
      ["hero", "setHero"],
    ]) {
      await page.evaluate((h) => window.__wpTopo[h](), hook)
      // render a few frames so atmosphere/fog converge.
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.__wpTopo.render())
        await sleep(60)
      }
      const out = `/tmp/wp-topo-${arch}-${shot}.png`
      await page.screenshot({ path: out })
      console.log(`  ✓ ${out}`)
    }
  }

  await browser.close()
  cleanup()
  console.log(failures ? `\n${failures} archetype(s) failed to render` : "\nrendered ✔")
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  cleanup()
  process.exit(1)
})
