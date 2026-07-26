// Reaction bench: the three claims a unit test cannot close.
//
// `reactions.test.ts` drives the stage with an injected clock and a recording
// context, which proves the logic and proves nothing about a browser. These are
// the same claims measured against real pixels in a real compositor:
//
//   Q-04  interruption      a child answers mid-animation. The picture must be
//                           gone within 90 ms and the keystroke must land — not
//                           be dropped, not be queued behind the animation.
//   Q-02  live nodes        the world's node count in the DOM must equal what
//                           `construction.ts` says it is. The model claims a
//                           number; this reads it off the page.
//   Q-01  no reflow         the construction band must not move the slate when
//                           an aperture is cut or the character speaks — checked
//                           at 320 px, where it once did.
//
// Interruption is measured by counting non-transparent pixels on the reaction
// canvas, which is the only honest reading of "the picture is gone" — a state
// flag would be measuring the app's opinion of itself.
//
//   npm run dev                    # in another shell
//   node tools/bench-reactions.mjs
//
// A developer-machine number, like `bench-loop.mjs`. The device measurement is
// `Q-01`/`Q-02` on a Galaxy Tab A9 and no script can close it.

import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const APP_URL = process.env.DW_URL ?? "http://127.0.0.1:1423/#/practice"
const PORT = 9337
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const profile = mkdtempSync(path.join(tmpdir(), "dw-react-"))
const args = [
  "--headless=new",
  `--remote-debugging-port=${String(PORT)}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-extensions",
  "--hide-scrollbars",
  "--window-size=390,844",
]
// The reduced-motion branch is a different code path with a different budget;
// running the same probes against it is how `Q-06` stops being a claim about
// CSS nobody executed.
if (process.env.REDUCED === "1") args.push("--force-prefers-reduced-motion")
const chrome = spawn(CHROME, args, { stdio: "ignore" })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function endpoint() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const list = await fetch(`http://127.0.0.1:${String(PORT)}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === "page")
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await sleep(200)
  }
  throw new Error("chrome did not expose a debugging endpoint")
}

const socket = new WebSocket(await endpoint())
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true })
  socket.addEventListener("error", reject, { once: true })
})

let nextId = 0
const pending = new Map()
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data)
  const waiter = pending.get(message.id)
  if (waiter === undefined) return
  pending.delete(message.id)
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
  else waiter.resolve(message.result)
})

function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }).catch((error) => {
      if (!String(error.message).includes("collected")) throw error
      return null
    })
    if (result === null) {
      await sleep(300)
      continue
    }
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? "page threw")
    }
    return result.result.value
  }
  throw new Error("evaluate never settled")
}

const HELPERS = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const frame = () => new Promise((r) => requestAnimationFrame(r))
  const slate = () => document.querySelector(".dw-slate")
  const band = () => document.querySelector(".dw-anchor-cartouche")
  const answer = () => document.querySelector(".dw-anchor-seat")
  const key = (k) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))
  const digits = (s) => (s.match(/\\d+/g) ?? [])
  // Non-transparent pixels on the reaction canvas. The only honest reading of
  // "the picture is gone": a flag would be the app grading its own homework.
  const inked = () => {
    const canvas = document.querySelector("canvas")
    if (!canvas) return -1
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let n = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] > 4) n++
    return n
  }
  const answerRight = async () => {
    while (!slate()) { key("Enter"); await sleep(180) }
    const d = digits(slate().innerText)
    if (d.length < 2) return false
    for (const ch of (BigInt(d[0]) - BigInt(d[1])).toString()) key(ch)
    await sleep(16)
    key("Enter")
    return true
  }
`

/**
 * Answer `n` cards correctly, sampling the slate's box on every card so the
 * band's arrival can be shown not to move it.
 */
const PLAY = (n) => `(async () => {
  ${HELPERS}
  const boxes = []
  for (let i = 0; i < ${String(n)}; i++) {
    while (!slate()) { key("Enter"); await sleep(180) }
    // Sampled past the present animation: dw-present slides the card up 8 px
    // over one detent, so a box read on arrival measures the keyframe, not the
    // layout. An earlier cut of this probe reported a 1.16 px reflow that was
    // entirely the animation.
    await sleep(260)
    const box = slate().getBoundingClientRect()
    boxes.push([Math.round(box.top * 100) / 100, Math.round(box.left * 100) / 100])
    if (!(await answerRight())) { i--; await sleep(60); continue }
    await sleep(520)
  }
  const tops = boxes.map((b) => b[0]), lefts = boxes.map((b) => b[1])
  return JSON.stringify({
    cards: boxes.length,
    slateTopSpreadPx: Math.max(...tops) - Math.min(...tops),
    slateLeftSpreadPx: Math.max(...lefts) - Math.min(...lefts),
    bandHeightPx: band() ? band().getBoundingClientRect().height : null,
  })
})()`

/**
 * Answer the card that closes a milestone, wait until the reaction is visibly
 * on the canvas, then interrupt it with a digit and time both halves: how long
 * the picture takes to go, and whether the digit landed.
 */
const INTERRUPT = `(async () => {
  ${HELPERS}
  await answerRight()
  // Let the reaction get going. It is fired from the frame after the verdict
  // paints, so the first two frames are legitimately empty.
  let ink = 0
  for (let i = 0; i < 30 && ink <= 0; i++) { await frame(); ink = inked() }
  if (ink <= 0) return JSON.stringify({ reached: false })

  // Interrupt mid-flight. Enter moves past the verdict, then a digit — which
  // is a real answer keystroke, the thing that must never be dropped.
  key("Enter")
  await frame()
  const started = performance.now()
  key("7")
  const handlerMs = performance.now() - started
  // The keystroke must reach the field on the next frame — it is React state,
  // so it cannot be synchronous, but it must not wait on the animation. The
  // reaction is still settling while this is checked.
  await frame()
  const landedAt = performance.now() - started
  const landed = (answer()?.textContent ?? "").includes("7")

  let cleared = null
  for (let i = 0; i < 20; i++) {
    await frame()
    if (inked() === 0) { cleared = performance.now() - started; break }
  }
  return JSON.stringify({
    reached: true,
    peakInkPx: ink,
    keyHandlerMs: Math.round(handlerMs * 100) / 100,
    keyLandedNextFrame: landed,
    keyLandedAtMs: Math.round(landedAt * 100) / 100,
    clearedMs: cleared === null ? null : Math.round(cleared * 100) / 100,
  })
})()`

/**
 * Force every fragment into the band and read its height back. Reaching into
 * the DOM rather than driving the character is deliberate: he speaks four times
 * a session at genuine milestones, and waiting for all twelve would take longer
 * than the bench is worth.
 */
const BAND_HEIGHTS = `(() => {
  const band = document.querySelector(".dw-anchor-cartouche")
  if (!band) return JSON.stringify({ band: null })
  const p = band.querySelector("p")
  const rest = band.getBoundingClientRect().height
  let max = rest, worst = ""
  for (const line of ${JSON.stringify([
    "What you borrowed, you spent. It did not stay behind.",
    "You gave it up this time. Most do not, at first.",
    "A ten cannot sit in two places. You saw that.",
    "Nothing left over. That is the whole of it.",
    "180 apertures. The light has somewhere to go now.",
    "It closes. Cut stone does, when the order is right.",
    "A shape, where there was a hole.",
    "That will hold weight. Not all of them do.",
    "These have a hole in the middle. Watch where the ten goes.",
    "Zero is not nothing. It is a place with nothing in it.",
    "Now the empty column.",
    "Reach past the zero. It has nothing of its own to lend.",
  ])}) {
    p.textContent = line
    const h = band.getBoundingClientRect().height
    if (h > max) { max = h; worst = line }
  }
  p.textContent = ""
  return JSON.stringify({ restPx: rest, speakingPx: max, movedPx: Math.round((max - rest) * 100) / 100, worst })
})()`

const WORLD = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  location.hash = "#/world"
  await sleep(500)
  const svg = document.querySelector("#dw-world")
  return JSON.stringify({
    placed: JSON.parse(localStorage.getItem("dynawalla.p1.world") ?? '{"state":{}}').state.placed ?? 0,
    domNodes: svg ? svg.children.length : null,
    label: svg ? svg.getAttribute("aria-label") : null,
  })
})()`

try {
  await send("Page.enable")
  await send("Runtime.enable")
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send("Page.navigate", { url: APP_URL })
  await sleep(2200)
  await evaluate("localStorage.clear(), 1")
  await send("Page.navigate", { url: APP_URL })
  await send("Page.reload", { ignoreCache: true })
  await sleep(2400)

  console.log("── Q-01, the band does not move the work ─────────────────────")
  console.log(await evaluate(PLAY(9)))

  console.log("\n── Q-04, interrupting the star (tier 2, 900 ms) ──────────────")
  console.log(await evaluate(INTERRUPT))

  console.log(await evaluate(PLAY(10)))
  console.log("\n── Q-04, interrupting the rosette (tier 3, 1800 ms) ──────────")
  console.log(await evaluate(INTERRUPT))

  console.log("\n── Q-02, the world's nodes in the DOM ────────────────────────")
  console.log(await evaluate(WORLD))

  // The band's height with every fragment in it, at the narrowest width this
  // app ships to. `min-h-16` passed at 390 and 360 and grew 3.5 px at 320,
  // which is why this probe measures the widths rather than one width.
  console.log("\n── Q-01, the band's height with the character speaking ───────")
  for (const width of [320, 360, 390]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await evaluate('location.hash = "#/practice", 1')
    await sleep(500)
    console.log(width, await evaluate(BAND_HEIGHTS))
  }
} finally {
  socket.close()
  chrome.kill()
  await sleep(300)
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
