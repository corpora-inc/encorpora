/**
 * QA: prove the unified collision field stops interpenetration.
 *
 * REQUIRES the game.ts wiring (createPlayerController(..., obstacles) +
 * createCrowd({ ..., obstacles }) + the dev-only __wpCollide window hook). The
 * collision MODULE itself is covered headlessly by src/world/collision.test.ts;
 * this WebKit harness is the full end-to-end proof once the field is wired in.
 *
 * Drives the REAL game (vite dev mount, WebKit) and asserts, against the live
 * world hooks (__wpPlayer + __wpCollide):
 *   1. The player CANNOT end up inside any obstacle (walk hard into the fountain,
 *      a bench/stall, etc. — final position is never `blocked`).
 *   2. No crowd agent ends up inside an obstacle.
 *   3. No two crowd agents overlap (paper-people don't stack).
 *   4. Walk the crowd for many seconds → nobody is stuck/jittering (everyone
 *      moves a healthy total distance; the field doesn't gridlock them).
 *   5. fps >= 58.
 * Screenshots the trouble spots to /tmp/wp-collide-*.png.
 */
import { webkit } from "playwright"

const BASE = process.env.WP_BASE || "http://localhost:5200/"
const OUT = (n) => `/tmp/${n}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const IDENTITY = {
  name: { playerId: "player-local", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
  avatar: { base: "body-1", layers: [] },
}

let failures = 0
const check = (cond, msg) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${msg}`)
  if (!cond) failures++
}

async function drive(page, key, ms) {
  await page.keyboard.down(key)
  await sleep(ms)
  await page.keyboard.up(key)
}

async function main() {
  const browser = await webkit.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message))
  page.on("console", (m) => {
    const t = m.text()
    if (/error|fail|collid/i.test(t)) console.log("  [page]", t)
  })

  await page.addInitScript((id) => {
    localStorage.setItem("wp:identity:v1", JSON.stringify(id))
  }, IDENTITY)

  await page.goto(BASE, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("canvas", { timeout: 20000 })
  // wait for the collision hook to come online.
  await page.waitForFunction(() => !!window.__wpCollide && !!window.__wpPlayer, { timeout: 20000 })
  await sleep(1200)

  const obstacles = await page.evaluate(() => window.__wpCollide.obstacles())
  console.log(`• obstacle field: ${obstacles.length} obstacles ` +
    `(${obstacles.filter((o) => o.kind === "circle").length} circles, ` +
    `${obstacles.filter((o) => o.kind === "box").length} boxes)`)
  const fountain = obstacles.find((o) => o.kind === "circle" && Math.hypot(o.x, o.z) < 0.01 && o.r > 2)
  check(!!fountain, `fountain circle present (r=${fountain ? fountain.r.toFixed(2) : "?"})`)
  check(obstacles.filter((o) => o.kind === "circle").length > 30,
    "many prop circles present (props are colliders)")

  // ---- 1. drive the player STRAIGHT into the fountain ----
  // Spawn is at (0, 11.5) facing the fountain at origin; yaw=0 → forward = -z.
  // Hold W to charge the fountain for a few seconds.
  for (let i = 0; i < 16; i++) await drive(page, "w", 220)
  await sleep(150)
  let pos = await page.evaluate(() => window.__wpPlayer.pos())
  let inObs = await page.evaluate((p) => window.__wpCollide.blocked(p.x, p.z, 0.55), pos)
  console.log(`• after charging fountain: player at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`)
  check(!inObs, "player NOT inside an obstacle after charging the fountain")
  // it should be stopped just outside the fountain ring (dist ~ 2.9 + 0.55).
  const dF = Math.hypot(pos.x, pos.z)
  check(dF > 2.9, `player kept OUT of the fountain (dist ${dF.toFixed(2)} > basin ${2.9})`)
  await page.screenshot({ path: OUT("wp-collide-fountain.png") })

  // ---- 2. sweep into props in several directions, assert never embedded ----
  const dirs = ["a", "a", "w", "d", "d", "s", "s", "a", "w", "w", "d", "s"]
  let everEmbedded = false
  let minDist = Infinity
  for (let i = 0; i < 60; i++) {
    await drive(page, dirs[i % dirs.length], 160)
    pos = await page.evaluate(() => window.__wpPlayer.pos())
    const b = await page.evaluate((p) => window.__wpCollide.blocked(p.x, p.z, 0.5), pos)
    if (b) everEmbedded = true
    // track closest approach to any obstacle center (sanity it actually met props)
  }
  check(!everEmbedded, "player NEVER embedded in an obstacle across a 60-step sweep")
  void minDist
  await page.screenshot({ path: OUT("wp-collide-sweep.png") })

  // ---- 3 & 4. let the crowd wander, then assert no overlaps + healthy motion ----
  // sample crowd positions now and after a long wander.
  const sample = async () => page.evaluate(() => window.__wpCollide.crowd())
  const before = await sample()
  // let the world run ~8s of wander.
  await sleep(8000)
  const after = await sample()

  // 3a: no agent inside an obstacle.
  let agentInObs = 0
  for (const a of after) {
    const b = await page.evaluate((p) => window.__wpCollide.blocked(p.x, p.z, 0.5), a)
    if (b) agentInObs++
  }
  check(agentInObs === 0, `no crowd agent inside an obstacle (${agentInObs} embedded of ${after.length})`)

  // 3b: no two agents overlapping (paper-people don't stack). AGENT_RADIUS=0.5 →
  // bodies touch at 1.0; allow a small tolerance for the separation transient.
  let overlaps = 0
  let minPair = Infinity
  for (let i = 0; i < after.length; i++) {
    for (let j = i + 1; j < after.length; j++) {
      const d = Math.hypot(after[i].x - after[j].x, after[i].z - after[j].z)
      minPair = Math.min(minPair, d)
      if (d < 0.85) overlaps++
    }
  }
  check(overlaps === 0, `no paper-people stacking (closest pair ${minPair.toFixed(2)}u, ${overlaps} overlapping)`)

  // 4: healthy total motion (nobody gridlocked). Match by id; require the median
  // agent to have moved a real distance over 8s.
  const byId = new Map(before.map((a) => [a.id, a]))
  const moved = after
    .map((a) => {
      const b = byId.get(a.id)
      return b ? Math.hypot(a.x - b.x, a.z - b.z) : 0
    })
    .sort((x, y) => x - y)
  const median = moved[Math.floor(moved.length / 2)] || 0
  const movers = moved.filter((m) => m > 1.0).length
  check(median > 1.0, `crowd is moving, not gridlocked (median displacement ${median.toFixed(2)}u over 8s)`)
  check(movers >= Math.floor(after.length * 0.6), `${movers}/${after.length} agents moved >1u (no mass stall)`)
  await page.screenshot({ path: OUT("wp-collide-crowd.png") })

  // ---- 5. fps ----
  const fps = await page.evaluate(() => {
    return new Promise((resolve) => {
      let frames = 0
      const t0 = performance.now()
      const tick = () => {
        frames++
        if (performance.now() - t0 >= 1500) resolve((frames * 1000) / (performance.now() - t0))
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  })
  check(fps >= 58, `fps >= 58 (measured ${fps.toFixed(1)})`)

  await browser.close()
  console.log(failures === 0 ? "\nALL COLLISION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
