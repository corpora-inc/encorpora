/**
 * QA: prove `crowd.restationSpecials()` re-stations the objective NPCs at runtime
 * (#58) — the fix that lets a quest SWITCH / progression move the talkable NPC to
 * the new active anchor (so the fountain/market/bridge beacon is never empty).
 *
 * Boots the standalone plaza, drives through onboarding, then via the dev hooks:
 *   1. reads the INITIAL stationed specials (one per catalog objective anchor),
 *   2. calls `__wpRestation([...])` with a NEW special set (a subset, renamed),
 *   3. asserts each new entry's NPC now stands AT its anchor with the NEW name,
 *      and the dropped anchors are unstaffed (parked) — no ghost NPCs left behind.
 *
 * Self-contained: spawns its own vite dev server on an ephemeral port.
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"

const PORT = process.env.WP_PORT || "5247"
const SPECIAL_IDS = ["plaza", "market", "fountain", "harbor", "bridge_n"]
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

async function main() {
  const vite = spawn("npx", ["vite", "--port", PORT, "--strictPort"], { cwd: process.cwd(), stdio: "ignore" })
  const cleanup = () => { try { vite.kill("SIGKILL") } catch {} }
  process.on("exit", cleanup)
  await sleep(4500)

  const browser = await webkit.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } })
  page.on("console", (m) => { if (/wp\/crowd|restation/i.test(m.text())) console.log("  [page]", m.text().slice(0, 160)) })
  page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)))

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" })

  // drive welcome + onboarding to completion (Skip, else any primary CTA / welcome).
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => typeof window.__wpCrowd === "function")) break
    await page.evaluate(() => {
      const skip = document.querySelector(".wp-onb-skip"); if (skip) return skip.click()
      const prim = document.querySelector(".wp-onb-btn--primary"); if (prim) return prim.click()
      const cta = Array.from(document.querySelectorAll("button")).find((b) => /morning|step into|begin/i.test(b.textContent || "")); if (cta) cta.click()
    })
    await sleep(600)
  }
  await page.waitForFunction(
    () => typeof window.__wpCrowd === "function" && typeof window.__wpRestation === "function",
    { timeout: 25000 },
  )
  await sleep(1500)

  const dump = () => page.evaluate(() => window.__wpCrowd())
  const specialsOf = (frame) => frame.filter((a) => SPECIAL_IDS.includes(a.anchorId) && Math.abs(a.x) < 1e5)

  // ── 1) initial specials: one body per objective anchor ──
  const before = specialsOf(await dump())
  console.log("• BEFORE — stationed specials:", before.map((s) => `${s.anchorId}="${s.name}"`).join(", "))
  if (before.length < 2) throw new Error(`expected ≥2 initial specials, got ${before.length}`)
  const beforePos = Object.fromEntries(before.map((s) => [s.anchorId, { x: s.x, z: s.z }]))

  // ── 2) RE-STATION to a NEW quest's specials: market + bridge_n, both renamed ──
  const NEW = [
    { anchorId: "market", name: "Beatriz the Vendor", role: "townsperson" },
    { anchorId: "bridge_n", name: "Old Tomás the Keeper", role: "gatekeeper" },
  ]
  await page.evaluate((s) => window.__wpRestation(s), NEW)
  await sleep(900)

  // ── 3) assert: the new set is staffed + renamed AT its anchor; the rest parked ──
  const after = specialsOf(await dump())
  console.log("• AFTER  — stationed specials:", after.map((s) => `${s.anchorId}="${s.name}"`).join(", "))

  if (after.length !== NEW.length) {
    throw new Error(`expected exactly ${NEW.length} staffed specials after restation, got ${after.length} (dropped anchors should be parked)`)
  }
  for (const want of NEW) {
    const got = after.find((a) => a.anchorId === want.anchorId)
    if (!got) throw new Error(`no NPC stationed at re-stationed anchor "${want.anchorId}"`)
    if (got.name !== want.name) throw new Error(`anchor "${want.anchorId}" shows name "${got.name}", expected "${want.name}" (persona not re-stationed)`)
    // the NPC must stand AT the anchor (within a small station radius of where the
    // original objective body stood — same anchor, so same spot ± leash).
    const ref = beforePos[want.anchorId]
    if (ref && dist(got, ref) > 4) {
      throw new Error(`re-stationed NPC at "${want.anchorId}" is ${dist(got, ref).toFixed(1)}u off its anchor`)
    }
  }
  // dropped anchors (plaza/fountain/harbor) must be EMPTY now (parked off-map).
  for (const dropped of SPECIAL_IDS.filter((id) => !NEW.some((n) => n.anchorId === id))) {
    if (after.find((a) => a.anchorId === dropped)) {
      throw new Error(`anchor "${dropped}" should be unstaffed after restation but still has an NPC`)
    }
  }

  await page.screenshot({ path: "/tmp/wp-restation.png" })
  await browser.close()
  console.log("\n✅ ALL CHECKS PASSED — restationSpecials moves + renames objective NPCs to the new anchor set, parks the rest.")
}

main().catch(async (e) => {
  console.error("\n❌", e.message)
  process.exit(1)
})
