/**
 * Multiplayer presence QA — TWO real windows in ONE plaza, seeing each other.
 *
 * Self-contained: boots the Colyseus server, starts vite, opens TWO webkit
 * windows against qa/mp.html (distinct identities), moves window A, and ASSERTS
 * window B receives + renders A's movement (polls B's remote-avatar position for
 * A). Screenshots both windows (each showing the other's avatar) → /tmp/wp-mp-*.png.
 *
 * Run:  node qa/mp-presence.mjs
 *   (assumes `npm run server:install` has been run once for server deps)
 *
 * Env:
 *   WP_MP_REUSE=1      reuse an already-running server+vite (don't spawn)
 *   WP_MP_SERVER=ws…   override server ws url (default ws://localhost:2567)
 *   WP_MP_BASE=http…   override vite base url (default http://localhost:5174)
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")

const SERVER_PORT = 2567
const VITE_PORT = 5174
const SERVER_WS = process.env.WP_MP_SERVER ?? `ws://localhost:${SERVER_PORT}`
const BASE = process.env.WP_MP_BASE ?? `http://localhost:${VITE_PORT}`
const REUSE = process.env.WP_MP_REUSE === "1"

const procs = []
const spawnProc = (cmd, args, name) => {
  // `detached` puts the child in its own process group so we can SIGTERM the
  // WHOLE tree (npm → tsx/vite grandchildren) on cleanup — otherwise the real
  // server/vite leak past this script's exit and hold the ports.
  const p = spawn(cmd, args, { cwd: packDir, stdio: "pipe", detached: true })
  p.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`))
  p.stderr.on("data", (d) => process.stderr.write(`[${name}] ${d}`))
  procs.push(p)
  return p
}

const portOpen = (port) =>
  // Try both loopback families: vite binds ::1 (localhost), colyseus 0.0.0.0.
  new Promise((res) => {
    let pending = 2
    let opened = false
    const done = (ok) => {
      if (ok) opened = true
      if (--pending === 0) res(opened)
    }
    for (const host of ["127.0.0.1", "::1"]) {
      const s = net.connect(port, host)
      s.once("connect", () => { s.destroy(); done(true) })
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
    // Negative pid → kill the whole process group (npm + its grandchildren).
    try { process.kill(-p.pid, "SIGKILL") } catch {}
    try { p.kill("SIGKILL") } catch {}
  }
}
process.on("exit", cleanup)
process.on("SIGINT", () => { cleanup(); process.exit(1) })

let exitCode = 0
let browserA, browserB
try {
  // ---- 1. boot server + vite (unless reusing) ----
  if (!REUSE) {
    console.log("→ booting Colyseus server…")
    spawnProc("npm", ["run", "server"], "server")
    await waitPort(SERVER_PORT, "colyseus server")
    console.log("→ starting vite dev…")
    spawnProc("npm", ["run", "dev", "--", "--port", String(VITE_PORT), "--strictPort"], "vite")
    await waitPort(VITE_PORT, "vite")
    await sleep(1200) // let vite finish first compile
  } else {
    console.log("→ reusing running server + vite")
  }

  const urlA = `${BASE}/qa/mp.html?name=Ada&server=${encodeURIComponent(SERVER_WS)}&hat=%23e0c060&top=%233f7fae&start=-6,0`
  const urlB = `${BASE}/qa/mp.html?name=Ben&server=${encodeURIComponent(SERVER_WS)}&hat=%23c0392b&top=%232e8b57&start=6,0`

  // ---- 2. open two windows ----
  browserA = await webkit.launch()
  browserB = await webkit.launch()
  const pageA = await (await browserA.newContext({ viewport: { width: 1100, height: 760 } })).newPage()
  const pageB = await (await browserB.newContext({ viewport: { width: 1100, height: 760 } })).newPage()
  // colyseus.js' WebSocketTransport probes the Node `new WebSocket(url,{headers})`
  // overload first; in WebKit that throws "Wrong protocol for WebSocket
  // '[object Object]'", which it CATCHES and recovers from (connection still
  // succeeds). WebKit surfaces the caught constructor error to window.onerror
  // anyway, so it's a benign false positive we filter out.
  const benign = (s) => /Wrong protocol for WebSocket/i.test(s)
  const errs = []
  for (const [tag, pg] of [["A", pageA], ["B", pageB]]) {
    pg.on("pageerror", (e) => { if (!benign(String(e))) errs.push(`${tag} pageerror: ${e}`) })
    pg.on("console", (m) => { if (m.type() === "error" && !benign(m.text())) errs.push(`${tag} console: ${m.text()}`) })
  }

  console.log("→ loading both windows…")
  await Promise.all([
    pageA.goto(urlA, { waitUntil: "load" }),
    pageB.goto(urlB, { waitUntil: "load" }),
  ])

  // ---- 3. wait until both are online and each sees one remote ----
  const waitFor = async (page, fn, label, timeoutMs = 15000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const v = await page.evaluate(fn).catch(() => null)
      if (v) return v
      await sleep(250)
    }
    throw new Error(`timed out: ${label}`)
  }

  await waitFor(pageA, () => window.__wpMp?.status() === "online", "A online")
  await waitFor(pageB, () => window.__wpMp?.status() === "online", "B online")
  console.log("✓ both windows online")

  await waitFor(pageA, () => (window.__wpMp?.remoteCount() ?? 0) >= 1, "A sees B")
  await waitFor(pageB, () => (window.__wpMp?.remoteCount() ?? 0) >= 1, "B sees A")
  console.log("✓ each window sees the other")

  // ---- 4. record B's view of A's position, then move A, then re-check ----
  const remoteOf = (page) => page.evaluate(() => window.__wpMp?.remotePositions()?.[0] ?? null)
  const aSeenByB_before = await remoteOf(pageB)
  console.log("B sees A at:", aSeenByB_before)

  // Move A forward for ~1.6s.
  await pageA.bringToFront()
  await pageA.keyboard.down("w")
  await sleep(1600)
  await pageA.keyboard.up("w")
  await sleep(600) // let interpolation catch up

  const aLocal = await pageA.evaluate(() => window.__wpMp?.playerPos())
  const aSeenByB_after = await remoteOf(pageB)
  console.log("A local pos:", aLocal)
  console.log("B sees A at:", aSeenByB_after)

  const remoteMoved = Math.hypot(
    (aSeenByB_after?.x ?? 0) - (aSeenByB_before?.x ?? 0),
    (aSeenByB_after?.z ?? 0) - (aSeenByB_before?.z ?? 0),
  )
  // B's rendered A should track A's actual local position (within interp slop).
  const trackErr = Math.hypot(
    (aSeenByB_after?.x ?? 0) - (aLocal?.x ?? 99),
    (aSeenByB_after?.z ?? 0) - (aLocal?.z ?? 99),
  )

  // ---- 5. screenshots: each window showing the OTHER's avatar ----
  await pageA.screenshot({ path: "/tmp/wp-mp-A.png" })
  await pageB.screenshot({ path: "/tmp/wp-mp-B.png" })

  // ---- 6. perf: B's HUD fps with a remote avatar present ----
  const hud = await pageB.$eval(".wp-perf-hud", (el) => el.textContent).catch(() => "(no hud)")
  const fps = Number((hud.match(/fps (\d+)/) ?? [])[1] ?? 0)

  console.log("\n=== MULTIPLAYER QA ===")
  console.log(`B's view of A moved: ${remoteMoved.toFixed(2)}u (expect > 1)`)
  console.log(`B-rendered A vs A-actual tracking error: ${trackErr.toFixed(2)}u (expect < 3)`)
  console.log(`B fps with remote avatar: ${fps}`)
  console.log("screenshots: /tmp/wp-mp-A.png /tmp/wp-mp-B.png")
  console.log("page errors:", errs.length ? errs.slice(0, 6) : "none")

  const ok =
    remoteMoved > 1 &&
    trackErr < 3 &&
    fps >= 55 &&
    errs.length === 0
  console.log(ok ? "\nRESULT: PASS — two windows, each sees the other walk" : "\nRESULT: CHECK (see above)")
  exitCode = ok ? 0 : 1
} catch (err) {
  console.error("FAILED:", err)
  exitCode = 1
} finally {
  if (browserA) await browserA.close().catch(() => {})
  if (browserB) await browserB.close().catch(() => {})
  cleanup()
}
process.exit(exitCode)
