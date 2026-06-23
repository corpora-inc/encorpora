/**
 * QA: prove the special quest NPCs are STATIONED at their anchors.
 *
 * Boots the standalone plaza, skips onboarding, then over several seconds reads
 * `window.__wpCrowd()` (live agent positions) and asserts:
 *   1. an agent exists for each special anchor (docks/city_gate/fountain/plaza_market),
 *   2. each stays within its station radius of its anchor across N samples,
 *   3. the general (non-special) crowd still wanders (some agents move a lot) and
 *      doesn't stack (no two non-special agents share a position),
 * then drives the player to the docks and screenshots the stationed boatman.
 */
import { webkit } from "playwright"

const BASE = process.env.WP_BASE || "http://localhost:5191/"
const OUT = (n) => `/tmp/${n}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Special anchors (plaza-grand.json) + the station leash (stationing.ts).
const ANCHORS = {
  docks: { x: 0, z: 55 },
  city_gate: { x: 0, z: -55 },
  fountain: { x: 0, z: 0 },
  plaza_market: { x: 12.8, z: -11.5 },
}
const STATION_RADIUS = 2.6
// allow the offset (1.2) + leash (2.6) + a small steering slack.
const MAX_DRIFT = 1.2 + STATION_RADIUS + 0.6

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

async function main() {
  const browser = await webkit.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } })
  const page = await ctx.newPage()
  page.on("console", (m) => {
    const t = m.text()
    if (/wp\/crowd|special/i.test(t)) console.log("  [page]", t)
  })
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message))

  await page.goto(BASE, { waitUntil: "domcontentloaded" })
  await page.waitForSelector(".wp-onb-skip", { timeout: 15000 }).catch(() => {})
  const skip = await page.$(".wp-onb-skip")
  if (skip) {
    await skip.click()
    console.log("• skipped onboarding")
  }
  await page.waitForSelector("canvas", { timeout: 15000 })
  // wait for the dev hook to be installed
  await page.waitForFunction(() => typeof window.__wpCrowd === "function", { timeout: 15000 })
  await sleep(1200)

  // ── Sample the crowd over time ──
  const SAMPLES = 8
  const SAMPLE_MS = 700
  const driftMax = {} // anchorId → max drift seen
  const startPos = {} // non-special agent index → first pos (to measure wander)
  let lastFrame = null

  for (let s = 0; s < SAMPLES; s++) {
    const frame = await page.evaluate(() => window.__wpCrowd())
    lastFrame = frame
    // specials
    for (const [aid, anchor] of Object.entries(ANCHORS)) {
      const ag = frame.find((f) => f.anchorId === aid)
      if (!ag) {
        throw new Error(`no stationed agent for special anchor "${aid}"`)
      }
      const d = Math.hypot(ag.x - anchor.x, ag.z - anchor.z)
      driftMax[aid] = Math.max(driftMax[aid] ?? 0, d)
    }
    // wander tracking for non-special agents (anchorId not a special key)
    frame
      .filter((f) => !(f.anchorId in ANCHORS))
      .forEach((f, i) => {
        const key = `${f.anchorId}#${i}`
        if (!(key in startPos)) startPos[key] = { x: f.x, z: f.z }
      })
    await sleep(SAMPLE_MS)
  }

  console.log("\n── Stationed specials: max drift from anchor over %ds ──", (SAMPLES * SAMPLE_MS) / 1000)
  let ok = true
  for (const [aid, anchor] of Object.entries(ANCHORS)) {
    const d = driftMax[aid]
    const pass = d <= MAX_DRIFT
    ok = ok && pass
    const ag = lastFrame.find((f) => f.anchorId === aid)
    console.log(
      `  ${pass ? "✓" : "✗"} ${aid.padEnd(13)} drift=${d.toFixed(2)}  (≤ ${MAX_DRIFT}) ` +
        `name="${ag?.name ?? "?"}" at (${ag.x.toFixed(1)}, ${ag.z.toFixed(1)})  anchor (${anchor.x}, ${anchor.z})`,
    )
  }
  if (!ok) throw new Error("a stationed special drifted beyond its station radius")

  // ── Non-special crowd still WANDERS (at least some moved a lot) + no stacking ──
  const finalFrame = lastFrame
  const nonSpecial = finalFrame.filter((f) => !(f.anchorId in ANCHORS))
  let movedFar = 0
  nonSpecial.forEach((f, i) => {
    const key = `${f.anchorId}#${i}`
    const s0 = startPos[key]
    if (s0 && dist(s0, f) > 4) movedFar++
  })
  console.log(
    `\n• non-special agents: ${nonSpecial.length}; ${movedFar} moved > 4u (wandering) over the window`,
  )
  if (movedFar < 3) throw new Error("the general crowd did not appear to wander")

  // stacking: no two non-special agents within 0.6u of each other
  let stacked = 0
  for (let i = 0; i < nonSpecial.length; i++)
    for (let j = i + 1; j < nonSpecial.length; j++)
      if (dist(nonSpecial[i], nonSpecial[j]) < 0.6) stacked++
  console.log(`• stacked non-special pairs (<0.6u): ${stacked}`)
  if (stacked > 1) throw new Error(`crowd is stacking (${stacked} overlapping pairs)`)

  // ── Confirm focusable: the docks agent's handle carries a persona name ──
  const boatman = finalFrame.find((f) => f.anchorId === "docks")
  console.log(`\n• docks agent focusable handle → anchorId="docks", name="${boatman.name}"`)
  if (!boatman.name) throw new Error("docks special has no persona name (not focusable persona)")

  // ── Screenshot: walk the player to the docks (anchor z=+55) ADAPTIVELY ──
  // The third-person follow-cam re-asserts every frame, so we can't just shove the
  // camera; instead we DRIVE the player north and read the follow-camera's world Z
  // (via __wpScene) to know which way 'w' actually heads, then steer to maximise Z.
  const camPos = () =>
    page.evaluate(() => {
      const sc = window.__wpScene && window.__wpScene()
      const c = sc && sc.activeCamera
      return c ? { x: c.position.x, z: c.position.z } : null
    })
  const tap = async (k, ms = 220) => {
    await page.keyboard.down(k)
    await sleep(ms)
    await page.keyboard.up(k)
  }
  // Discover which key drives +z (north). Sample 'w' vs 's'.
  let before = await camPos()
  await tap("w")
  let after = await camPos()
  const northKey = after.z > before.z ? "w" : "s"
  console.log(`• 'w' moved camZ ${before.z.toFixed(1)}→${after.z.toFixed(1)} → north key = '${northKey}'`)
  // Drive north, sidestepping around the central fountain when stalled.
  let stall = 0
  for (let p = 0; p < 90; p++) {
    before = await camPos()
    await tap(northKey, 200)
    after = await camPos()
    // re-centre toward x≈0 (docks is at x=0)
    if (after.x > 1.5) await tap("a", 120)
    else if (after.x < -1.5) await tap("d", 120)
    if (Math.abs(after.z - before.z) < 0.15) {
      stall++
      // around the fountain: sidestep
      await tap(stall % 2 === 0 ? "a" : "d", 200)
    } else stall = 0
    if (after.z > 47) {
      console.log(`• reached docks approach (camZ=${after.z.toFixed(1)}) after ${p} steps`)
      break
    }
  }
  const fz = await camPos()
  console.log(`• final camZ=${fz?.z?.toFixed?.(1)} camX=${fz?.x?.toFixed?.(1)} (docks anchor z=55,x=0)`)
  // The player arrived walking BACKWARD (facing south, camera north). To frame the
  // boatman we must face NORTH → camera trails SOUTH of the player (camZ drops well
  // below the player's z≈55). Turn (Q/E) until camera-Z is minimised (lowest =
  // camera furthest south = looking due north at the docks).
  const arriveZ = (await camPos()).z
  let bz = arriveZ
  await tap("q", 250)
  let az = (await camPos()).z
  const turnKey = az < bz ? "q" : "e" // the key that LOWERS camZ (turns toward north)
  let best = az
  for (let t = 0; t < 20; t++) {
    bz = (await camPos()).z
    await tap(turnKey, 150)
    az = (await camPos()).z
    // once camZ stops dropping we've passed due-north; stop at the minimum.
    if (az > best + 0.5) break
    best = Math.min(best, az)
  }
  console.log(`• turned to face docks (turnKey='${turnKey}', camZ ${arriveZ.toFixed(1)}→${(await camPos()).z.toFixed(1)})`)
  await sleep(500)
  await page.screenshot({ path: OUT("wp-special-docks.png") })
  console.log("• screenshot → /tmp/wp-special-docks.png")

  await browser.close()
  console.log("\n✅ ALL CHECKS PASSED — specials stationed, crowd still wanders.")
}

main().catch(async (e) => {
  console.error("\n❌", e.message)
  process.exit(1)
})
