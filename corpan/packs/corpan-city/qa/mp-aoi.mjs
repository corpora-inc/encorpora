/**
 * Area-of-Interest QA — PROVES the server's spatial interest management.
 *
 * Boots the Colyseus server with a SMALL AOI window (cell=40u, radius=1 → a
 * 120u-wide 3×3 cell window) and connects THREE headless colyseus.js clients
 * (no browser — pure protocol, fast + deterministic):
 *
 *   • Ada and Ben stay near the origin → SAME AOI window → MUST see each other.
 *   • Cara walks far away to (~110, ~110), several cells out → MUST NOT appear
 *     in Ada's or Ben's snapshot, and they MUST NOT appear in hers.
 *
 * Then Cara walks BACK toward the origin and we assert she RE-ENTERS the others'
 * snapshots cleanly (no ghost, no stuck avatar) — proving boundary crossings add
 * AND remove views symmetrically.
 *
 * Each client reads its server-filtered `players` map directly: a far player is
 * never even encoded into your state, so `room.state.players.size` (minus self)
 * is exactly your AOI peer count.
 *
 * Run:  node qa/mp-aoi.mjs
 *   (assumes server deps installed — `npm run server:install` once; uses the
 *    pack-root colyseus.js the real client uses.)
 *
 * Env:
 *   WP_MP_REUSE=1     reuse an already-running server (don't spawn one)
 *   WP_MP_SERVER=ws…  override server ws url (default ws://localhost:2569)
 */
import { Client, getStateCallbacks } from "colyseus.js"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")

// Use a DISTINCT port from mp-presence (2567) so the two harnesses can't clash.
const SERVER_PORT = Number(process.env.WP_AOI_PORT ?? 2569)
const SERVER_WS = process.env.WP_MP_SERVER ?? `ws://localhost:${SERVER_PORT}`
const REUSE = process.env.WP_MP_REUSE === "1"

// AOI tuning for the test (server reads these from env): a tight window so the
// origin and the far corner are unambiguously in different interest regions.
const AOI_CELL = 40
const AOI_RADIUS = 1
// Window half-extent in world units: radius cells beyond the player's own cell.
// Anyone within ±(radius+1)*cell of you (worst case across a cell boundary) is
// potentially visible; anyone clearly beyond (radius+1)*cell is NOT.
const FAR = 110 // (110,110) → cell (2,2) when origin is cell (0,0): out of a r=1 window.

const procs = []
const spawnProc = (cmd, args, name, extraEnv = {}) => {
  const p = spawn(cmd, args, {
    cwd: packDir,
    stdio: "pipe",
    detached: true,
    env: { ...process.env, ...extraEnv },
  })
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
    try { process.kill(-p.pid, "SIGKILL") } catch {}
    try { p.kill("SIGKILL") } catch {}
  }
}
process.on("exit", cleanup)
process.on("SIGINT", () => { cleanup(); process.exit(1) })

/**
 * A headless presence client. Mirrors what the real netClient does: joins,
 * watches the (AOI-filtered) players map via getStateCallbacks, and broadcasts
 * `move`s. Exposes `peers()` = sessionIds visible in MY snapshot (excluding me).
 */
async function makeClient(name, avatar) {
  const client = new Client(SERVER_WS)
  const room = await client.joinOrCreate("plaza", { name, avatar })
  const peers = new Set()
  const $ = getStateCallbacks(room)
  $(room.state).players.onAdd((_p, sessionId) => {
    if (sessionId !== room.sessionId) peers.add(sessionId)
  })
  $(room.state).players.onRemove((_p, sessionId) => {
    peers.delete(sessionId)
  })
  let seq = 0
  return {
    name,
    sessionId: () => room.sessionId,
    peers: () => new Set(peers),
    peerCount: () => peers.size,
    pos: () => {
      const me = room.state.players.get(room.sessionId)
      return me ? { x: me.x, z: me.z } : null
    },
    /** Send one authoritative-respecting move toward (tx,tz). */
    sendMove: (x, z) => room.send("move", { seq: seq++, pos: { x, z, facing: 0 }, t: Date.now() }),
    leave: () => room.leave(true),
  }
}

/**
 * Walk a client from its current pos to (tx,tz) in small steps that respect the
 * server's MAX_SPEED (14 u/s) anti-teleport clamp — exactly how a real client
 * arrives anywhere far. Polls until within `eps` or it times out.
 */
async function walkTo(c, tx, tz, { stepU = 6, hz = 12, timeoutMs = 8000, eps = 3 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const p = c.pos()
    if (!p) break
    const dx = tx - p.x
    const dz = tz - p.z
    const d = Math.hypot(dx, dz)
    if (d <= eps) return true
    const k = Math.min(stepU, d) / d
    c.sendMove(p.x + dx * k, p.z + dz * k)
    await sleep(1000 / hz)
  }
  return false
}

const settle = (ms = 600) => sleep(ms)

let exitCode = 0
try {
  if (!REUSE) {
    console.log(`→ booting Colyseus server (AOI cell=${AOI_CELL} radius=${AOI_RADIUS}) on :${SERVER_PORT}…`)
    spawnProc("npm", ["run", "server"], "server", {
      PORT: String(SERVER_PORT),
      WP_AOI_CELL: String(AOI_CELL),
      WP_AOI_RADIUS: String(AOI_RADIUS),
    })
    await waitPort(SERVER_PORT, "colyseus server")
    await sleep(800)
  } else {
    console.log("→ reusing running server")
  }

  // ---- connect three players ----
  console.log("→ connecting Ada, Ben, Cara…")
  const ada = await makeClient("Ada", { base: "paper-doll-a", layers: [] })
  const ben = await makeClient("Ben", { base: "paper-doll-a", layers: [] })
  const cara = await makeClient("Cara", { base: "paper-doll-a", layers: [] })
  await settle()

  // Pin Ada and Ben right next to each other near the origin (same AOI cell).
  await walkTo(ada, -4, 0)
  await walkTo(ben, 4, 0)
  await settle()

  // ---- ASSERT 1: near players see each other ----
  const adaSeesBen = ada.peers().has(ben.sessionId())
  const benSeesAda = ben.peers().has(ada.sessionId())
  console.log(`\nNEAR  Ada↔Ben:`)
  console.log(`  Ada peers: ${ada.peerCount()} (sees Ben=${adaSeesBen})`)
  console.log(`  Ben peers: ${ben.peerCount()} (sees Ada=${benSeesAda})`)

  // ---- walk Cara far away, then assert she's hidden ----
  console.log(`\n→ Cara walking to (${FAR}, ${FAR})…`)
  await walkTo(cara, FAR, FAR, { timeoutMs: 12000 })
  await settle(900)
  const cp = cara.pos()
  console.log(`  Cara at: (${cp?.x?.toFixed(1)}, ${cp?.z?.toFixed(1)})`)

  // ---- ASSERT 2: far player is hidden from the near pair (both directions) ----
  const adaSeesCara = ada.peers().has(cara.sessionId())
  const benSeesCara = ben.peers().has(cara.sessionId())
  const caraSeesAda = cara.peers().has(ada.sessionId())
  const caraSeesBen = cara.peers().has(ben.sessionId())
  console.log(`\nFAR  Cara hidden from Ada/Ben:`)
  console.log(`  Ada sees Cara=${adaSeesCara} (expect false)`)
  console.log(`  Ben sees Cara=${benSeesCara} (expect false)`)
  console.log(`  Cara peers: ${cara.peerCount()} (expect 0 — sees Ada=${caraSeesAda}, Ben=${caraSeesBen})`)

  // ---- ASSERT 3: Cara walks back → re-enters cleanly (no ghost / no dup) ----
  console.log(`\n→ Cara walking back to the origin…`)
  await walkTo(cara, 0, 0, { timeoutMs: 12000 })
  await settle(900)
  const adaSeesCaraBack = ada.peers().has(cara.sessionId())
  const caraSeesAdaBack = cara.peers().has(ada.sessionId())
  const caraSeesBenBack = cara.peers().has(ben.sessionId())
  console.log(`RETURN  Cara re-enters AOI:`)
  console.log(`  Ada sees Cara=${adaSeesCaraBack} (expect true)`)
  console.log(`  Cara peers: ${cara.peerCount()} (expect 2 — Ada=${caraSeesAdaBack}, Ben=${caraSeesBenBack})`)
  // No ghost: Ada must now see exactly Ben + Cara, not a stale duplicate.
  console.log(`  Ada peers after return: ${ada.peerCount()} (expect 2)`)

  // ---- verdict ----
  const pass =
    adaSeesBen && benSeesAda &&                 // near sees near
    !adaSeesCara && !benSeesCara &&             // far hidden from near pair
    !caraSeesAda && !caraSeesBen &&             // far sees nobody near
    cara.peerCount() >= 2 && adaSeesCaraBack && // returns cleanly, both sides
    caraSeesAdaBack && caraSeesBenBack &&
    ada.peerCount() === 2                       // no ghosts after the round-trip

  await Promise.all([ada.leave(), ben.leave(), cara.leave()].map((p) => p?.catch?.(() => {})))

  console.log("\n=== AOI QA ===")
  console.log(pass
    ? "RESULT: PASS — near-sees-near, far-is-hidden, boundary crossings clean"
    : "RESULT: FAIL — see assertions above")
  exitCode = pass ? 0 : 1
} catch (err) {
  console.error("FAILED:", err)
  exitCode = 1
} finally {
  cleanup()
}
process.exit(exitCode)
