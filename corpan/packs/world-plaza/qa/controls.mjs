/**
 * Control hardening verification for World Plaza (dual virtual joystick).
 *
 * Asserts, against the live WebKit build:
 *   1. A drag in the LEFT half moves the player (reads window.__wpPlayer.pos()).
 *   2. At most ONE stick per screen-half ever shows; a second left-half finger
 *      does not spawn a ghost stick.
 *   3. BOTH sticks can be active at once (move + look multi-touch).
 *   4. Sticks hide cleanly on release.
 *   5. A quick tap (no drag) registers as a tap and leaves NO stick on screen.
 *
 * The window.__wp* hooks are dev-only observability shims added in input.ts /
 * controller.ts — they carry no gameplay logic.
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, hasTouch: true })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))

await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(1500)

const results = []
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}

const sticks = () => page.evaluate(() => window.__wpInput?.sticks?.() ?? null)
const pos = () => page.evaluate(() => window.__wpPlayer?.pos?.() ?? null)

assert("dev hooks present", !!(await sticks()) && !!(await pos()))

// ---- 1. left-half drag moves the player ----------------------------------
const startPos = await pos()
// Drag upward (screen-up = forward) in the left half, holding a few frames.
const lx = 220
const ly = 520
// Use raw pointer-event dispatch for a precise, held multi-touch drag.
await page.evaluate(
  ([x, y]) => {
    const el = document.querySelector(".wp-overlay")
    const r = el.getBoundingClientRect()
    const make = (type, px, py, id) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: "touch",
          isPrimary: true,
          clientX: r.left + px,
          clientY: r.top + py,
          bubbles: true,
        }),
      )
    window.__wpDrag = { el, r, make }
    make("pointerdown", x, y, 1)
  },
  [lx, ly],
)
// step the knob upward over several frames
for (let i = 1; i <= 12; i++) {
  await page.evaluate(
    ([x, y]) => window.__wpDrag.make("pointermove", x, y, 1),
    [lx, ly - i * 8],
  )
  await page.waitForTimeout(40)
}
const midSticks = await sticks()
const leftActive = midSticks?.find((s) => s.side === "left")
const rightDuringLeft = midSticks?.find((s) => s.side === "right")
assert(
  "left stick active during left drag",
  !!leftActive?.active && leftActive.visible,
  JSON.stringify(leftActive),
)
assert(
  "no right stick spawned by left drag",
  !rightDuringLeft?.active && !rightDuringLeft?.visible,
)
await page.waitForTimeout(150)
const movedPos = await pos()
const dist = Math.hypot(movedPos.x - startPos.x, movedPos.z - startPos.z)
assert("player moved from left drag", dist > 0.2, `moved ${dist.toFixed(3)} units`)

// ---- 2. second left-half finger does NOT spawn a ghost stick -------------
await page.evaluate(() => window.__wpDrag.make("pointerdown", 120, 600, 2))
await page.waitForTimeout(60)
const twoFinger = await sticks()
const leftCount = twoFinger.filter((s) => s.side === "left" && s.active).length
assert("one stick per left half (ghost finger ignored)", leftCount === 1)
await page.evaluate(() => window.__wpDrag.make("pointerup", 120, 600, 2))

// ---- 3. both sticks active at once (multi-touch move + look) --------------
await page.evaluate(() => window.__wpDrag.make("pointerdown", 800, 400, 3))
await page.evaluate(() => window.__wpDrag.make("pointermove", 850, 400, 3))
await page.waitForTimeout(60)
const both = await sticks()
const bl = both.find((s) => s.side === "left")
const br = both.find((s) => s.side === "right")
assert("both sticks active simultaneously", !!bl?.active && !!br?.active)
await page.evaluate(() => window.__wpDrag.make("pointerup", 850, 400, 3))

// ---- 4. release hides every stick ----------------------------------------
await page.evaluate(() => window.__wpDrag.make("pointerup", 220, 400, 1))
await page.waitForTimeout(80)
const released = await sticks()
const anyVisible = released.some((s) => s.visible || s.active)
assert("all sticks hidden on release", !anyVisible, JSON.stringify(released))

// ---- 5. quick tap registers + leaves no stick ----------------------------
await page.evaluate(() => {
  window.__wpDrag.make("pointerdown", 300, 300, 9)
  window.__wpDrag.make("pointerup", 300, 300, 9)
})
await page.waitForTimeout(80)
const afterTap = await sticks()
assert("tap leaves no stick on screen", !afterTap.some((s) => s.visible || s.active))

await page.screenshot({ path: "/tmp/wp-controls.png" })
console.log("\npageerrors:", errors.length ? errors : "none")
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length ? 1 : 0)
