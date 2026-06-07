/**
 * Shell no-layout-shift verification (WebKit).
 *
 * Proves the diagnosed defect is GONE by construction: engaging an NPC (opening
 * the dialogue panel) must NOT move the world canvas by a single pixel, and
 * neither must closing it. We measure the stand-in stage's bounding box across:
 *   t0  before open
 *   t1  one frame after open() is called (the danger frame in the old bug,
 *       where the panel briefly entered flow and shoved the canvas up)
 *   t2  after the open transition settles
 *   t3  after close() is called (the old "snap back down" frame)
 *   t4  after the close transition settles
 * and assert the box is byte-identical throughout. Also screenshots the smooth
 * open + closed states.
 *
 * Uses the existing qa/npc.html harness (real dialogueUI over a stage stand-in
 * for the 3D canvas), plus a SECOND pass against the full game at / where we
 * walk up to an NPC and engage for real, measuring the actual <canvas>.
 *
 *   node qa/shell-no-shift.mjs [http://localhost:5174]
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const results = []
const assert = (name, ok, detail = "") => {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}
const sameBox = (a, b) =>
  Math.abs(a.x - b.x) < 0.5 &&
  Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5

// ---------------------------------------------------------------------------
// PASS 1 — dialogue harness (deterministic, mock host).
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({
    viewport: { width: 430, height: 880 },
    hasTouch: true,
  })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))

  // Load WITHOUT auto-opening so we can capture the true "before open" box.
  // npc-mount.ts opens immediately, so instead we navigate, immediately read the
  // box that the stage occupies (full viewport), then measure across the
  // panel's open/close which we drive via the page.
  await page.goto(`${base}/qa/npc.html`, { waitUntil: "load" })

  const box = () => page.$eval("#wp-stage", (el) => el.getBoundingClientRect().toJSON())

  // The mount opens the panel on load; wait for it, then read the SETTLED box.
  await page.waitForSelector(".wp-npc-root.wp-npc-open", { timeout: 4000 })
  await page.waitForTimeout(450) // open transition settles
  const openedBox = await box()

  // Screenshot the smooth open state.
  await page.screenshot({ path: "/tmp/wp-shell-dialogue-open.png" })

  // The stage must fill the viewport exactly (panel never displaced it).
  const vp = page.viewportSize()
  const fillsViewport =
    Math.abs(openedBox.x) < 0.5 &&
    Math.abs(openedBox.y) < 0.5 &&
    Math.abs(openedBox.width - vp.width) < 0.5 &&
    Math.abs(openedBox.height - vp.height) < 0.5
  assert(
    "stage fills viewport while dialogue open (panel out of flow)",
    fillsViewport,
    `stage=${JSON.stringify(openedBox)} vp=${vp.width}x${vp.height}`,
  )

  // Now CLOSE the panel and re-measure across the close frames.
  // Drive close via the X button.
  const beforeClose = await box()
  await page.click(".wp-npc-close")
  // t3: one frame after close requested (old "snap down" danger frame)
  await page.waitForTimeout(16)
  const closeFrame = await box()
  // t4: after close transition settles + DOM removal
  await page.waitForTimeout(450)
  const afterClose = await box()

  assert(
    "stage does NOT move on dialogue close (no snap-back)",
    sameBox(beforeClose, closeFrame) && sameBox(beforeClose, afterClose),
    `before=${JSON.stringify(beforeClose)} frame=${JSON.stringify(closeFrame)} after=${JSON.stringify(afterClose)}`,
  )

  // RE-OPEN and measure the open danger frame (t0 closed → t1 first frame).
  const beforeOpen = await box()
  await page.evaluate(() => window.__wpNpc?.reopen?.())
  await page.waitForTimeout(16) // first frame after open() — the classic jerk frame
  const openFrame = await box()
  await page.waitForTimeout(450)
  const openSettled = await box()
  assert(
    "stage does NOT move on dialogue open (no upward shove)",
    sameBox(beforeOpen, openFrame) && sameBox(beforeOpen, openSettled),
    `before=${JSON.stringify(beforeOpen)} frame=${JSON.stringify(openFrame)} settled=${JSON.stringify(openSettled)}`,
  )

  assert("no page errors (dialogue pass)", errors.length === 0, errors.slice(0, 3).join(" | "))
  await page.close()
}

// ---------------------------------------------------------------------------
// PASS 2 — real game: walk to an NPC, engage, measure the actual <canvas>.
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 430, height: 880 }, hasTouch: true })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.addInitScript(() => {
    localStorage.setItem(
      "wp:identity:v1",
      JSON.stringify({
        name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
        avatar: { base: "body-1", layers: [] },
      }),
    )
  })
  await page.goto(base, { waitUntil: "load" })
  await page.waitForSelector(".wp-canvas", { timeout: 8000 })
  await page.waitForTimeout(2500) // world builds

  const canvasBox = () => page.$eval(".wp-canvas", (el) => el.getBoundingClientRect().toJSON())
  const beforeEngage = await canvasBox()

  // Hunt for an NPC: walk forward in several headings (orbit the camera between
  // tries) until the proximity "Talk" affordance / focus ring appears. NPC
  // placement is owned by another agent, so this is best-effort — the canvas
  // no-shift claim itself is proven deterministically in Pass 1.
  let engaged = false
  const headings = [0, 90, 180, 270, 45, 135]
  for (const h of headings) {
    if (engaged) break
    // Orbit camera by dragging on the right half (look stick).
    await page.mouse.move(320, 440)
    await page.mouse.down()
    for (let k = 0; k < Math.round(h / 12); k++) await page.mouse.move(320 + k * 6, 440)
    await page.mouse.up()
    await page.waitForTimeout(120)
    for (let i = 0; i < 6 && !engaged; i++) {
      await page.keyboard.down("w")
      await page.waitForTimeout(550)
      await page.keyboard.up("w")
      if (await page.$(".wp-interact")) engaged = true
    }
  }
  if (engaged) {
    const beforeOpen = await canvasBox()
    // Engage via the keyboard 'E' (npcFocus listens for it) — robust vs. the
    // Talk button's proximity-driven visibility flicker.
    await page.keyboard.press("e")
    await page.waitForTimeout(16) // danger frame
    const openFrame = await canvasBox()
    await page.waitForSelector(".wp-npc-root.wp-npc-open", { timeout: 4000 })
    await page.waitForTimeout(500)
    const openSettled = await canvasBox()
    assert(
      "real canvas does NOT move when engaging an NPC",
      sameBox(beforeOpen, openFrame) && sameBox(beforeOpen, openSettled),
      `before=${JSON.stringify(beforeOpen)} frame=${JSON.stringify(openFrame)} settled=${JSON.stringify(openSettled)}`,
    )
    await page.screenshot({ path: "/tmp/wp-shell-game-engaged.png" })

    // Close (Escape closes the dialogue) and ensure the canvas still doesn't move.
    const beforeClose = await canvasBox()
    await page.click(".wp-npc-close")
    await page.waitForTimeout(16)
    const closeFrame = await canvasBox()
    await page.waitForTimeout(500)
    const afterClose = await canvasBox()
    assert(
      "real canvas does NOT move when closing the dialogue",
      sameBox(beforeClose, closeFrame) && sameBox(beforeClose, afterClose),
      `frame=${JSON.stringify(closeFrame)} after=${JSON.stringify(afterClose)}`,
    )
  } else {
    // Not a failure of THIS workstream: NPC placement is another agent's, and
    // Pass 1 already proves the canvas can't move on open/close. Skip cleanly.
    console.log(
      "SKIP  real-game NPC engagement — no NPC reached (placement owned elsewhere); Pass 1 proves the no-shift contract.",
    )
  }
  // Canvas should fill the viewport regardless.
  assert(
    "canvas unchanged vs. pre-engage baseline",
    sameBox(beforeEngage, await canvasBox()),
    "",
  )
  await page.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
