// Reaction bench: the claims a unit test cannot close.
//
// `reactions.test.ts` drives the stage with an injected clock and a recording
// context, which proves the logic and proves nothing about a browser. These are
// the same claims measured against real pixels in a real compositor:
//
//   Q-04  interruption      a child answers mid-animation. The picture must be
//                           gone within 90 ms of the interrupting keypress and
//                           the keystroke must land — not be dropped, not be
//                           queued behind the animation.
//   —     lifetime          and the other half, which nothing measured at all:
//                           a reaction nobody interrupts must run its tier's
//                           budget. The loop's own auto-advance was settling
//                           every one of them at 420 ms.
//   Q-02  live nodes        the world's node count in the DOM must equal what
//                           `construction.ts` says it is.
//   Q-01  no reflow         the construction band must not move the slate when
//                           an aperture is cut or the character speaks.
//   —     the fold          the control that commits an answer must be on
//                           screen at the shortest viewport this app ships to.
//
// ## Three things this file gets right that its first cut did not
//
// 1. **It asserts.** Every probe below is checked and a failure exits non-zero.
//    The first cut printed numbers, and a 40× drop in peak ink between a
//    supposed tier 2 and a supposed tier 3 was published without comment.
// 2. **It knows which tier it measured.** `window.__dwReaction` is a dev-only
//    read-back of what the stage actually fired. The first cut *inferred* the
//    tier from the number of cards answered — and inferred it wrong: a stray
//    digit left in the answer field made ten subsequent answers wrong, so the
//    probe labelled "the rosette, tier 3" ran at 18 apertures, where there is
//    no milestone at all, and measured a SEAT.
// 3. **It times from the keypress that settles.** `Q-04`'s clock starts at the
//    interrupting input. That is the `Enter`; the digit after it is the input
//    that must still land. Timed from the digit, the reported figure was one
//    frame short of the truth.
//
// Interruption is measured by counting non-transparent pixels on the reaction
// canvas, which is the only honest reading of "the picture is gone" — a state
// flag would be measuring the app's opinion of itself.
//
//   npm run dev                    # in another shell
//   npm run bench:reactions
//
// A developer-machine number, like `bench-loop.mjs`. The device measurement is
// `Q-01`/`Q-02` on a Galaxy Tab A9 and no script can close it.

import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const APP_URL = process.env.DW_URL ?? "http://127.0.0.1:1423/#/practice"
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

/** `Q-04`'s limit, from the interrupting keypress to an empty canvas. */
const SETTLE_LIMIT_MS = 90

/**
 * How much of its tier's budget an uninterrupted reaction must be on screen for.
 *
 * Not 100%, and the shortfall is honest rather than slack: every effect
 * cross-fades to nothing over its budget (`alpha = 1 − raw²`), so the last
 * frames are drawn below the alpha threshold `inked()` counts at and the
 * picture stops being *measurable* slightly before the clock stops. Measured at
 * 887/900 for the ILLUMINATE and 1648/1800 for the MECHANISM. The failure this
 * guards against is truncation — the loop cutting a reaction off at the 420 ms
 * hold, which reads as 27–31% — so the floor is what matters and the ceiling is
 * there to catch an effect that outlives its tier.
 */
const LIFETIME_FLOOR = 0.85
const LIFETIME_CEILING = 1.1

const failures = []
function check(ok, message) {
  if (ok) return
  failures.push(message)
  console.log(`   FAIL  ${message}`)
}

// Port 0, not a fixed one, and the port is read back from the profile Chrome
// actually wrote it into.
//
// This is not tidiness. A killed headless Chrome can outlive the `kill()` by a
// second or two, so a bench on a fixed port attaches to the *previous* run's
// browser — which is what happened here: the `REDUCED=1` pass reported "all
// probes green" while driving a browser launched without
// `--force-prefers-reduced-motion`, so `Q-06`'s only browser-side evidence was
// measuring the ordinary code path. A stale-browser bug is indistinguishable
// from a pass, which is the worst property a harness can have.
const profile = mkdtempSync(path.join(tmpdir(), "dw-react-"))
const args = [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-extensions",
  "--hide-scrollbars",
  "--window-size=390,844",
]
// The reduced-motion branch is a different code path with a different budget;
// running the same probes against it is how `Q-06` stops being a claim about
// CSS nobody executed.
const REDUCED = process.env.REDUCED === "1"
if (REDUCED) args.push("--force-prefers-reduced-motion")
const chrome = spawn(CHROME, args, { stdio: "ignore" })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The port this browser chose, from the file it writes into its own profile. */
async function port() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const chosen = readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]
      if (chosen && chosen.trim() !== "") return chosen.trim()
    } catch {
      /* not written yet */
    }
    await sleep(200)
  }
  throw new Error("chrome never wrote DevToolsActivePort")
}

async function endpoint() {
  const chosen = await port()
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const list = await fetch(`http://127.0.0.1:${chosen}/json/list`).then((r) => r.json())
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

const json = async (expression) => JSON.parse(await evaluate(expression))

const HELPERS = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const frame = () => new Promise((r) => requestAnimationFrame(r))
  const slate = () => document.querySelector(".dw-slate")
  const band = () => document.querySelector(".dw-anchor-cartouche")
  const answer = () => document.querySelector(".dw-anchor-seat")
  const key = (k) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))
  const digits = (s) => (s.match(/\\d+/g) ?? [])
  const placed = () =>
    JSON.parse(localStorage.getItem("dynawalla.p1.world") ?? '{"state":{}}').state.placed ?? 0
  // What the stage actually fired, read back from the dev-only hook. Inferring
  // it from the card count is how a SEAT got published as a MECHANISM.
  const fired = () => globalThis.__dwReaction ?? null
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
  const before = placed()
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
    placedBefore: before,
    placedAfter: placed(),
    slateTopSpreadPx: Math.max(...tops) - Math.min(...tops),
    slateLeftSpreadPx: Math.max(...lefts) - Math.min(...lefts),
    bandHeightPx: band() ? band().getBoundingClientRect().height : null,
  })
})()`

/**
 * Answer one card correctly and then touch nothing at all, sampling the canvas
 * every frame. This is the probe that did not exist: every other one interrupts
 * deliberately, so the loop's own auto-advance settling the reaction at 420 ms
 * was invisible to all of them.
 */
const LIFETIME = `(async () => {
  ${HELPERS}
  globalThis.__dwReaction = null
  const before = placed()
  while (!slate()) { key("Enter"); await sleep(180) }
  await sleep(200)
  await answerRight()
  const samples = []
  for (let i = 0; i < 200; i++) {
    await frame()
    samples.push([performance.now(), inked()])
  }
  const shot = fired()
  const lit = samples.filter((s) => s[1] > 0)
  const origin = shot ? shot.firedAt : (lit.length ? lit[0][0] : 0)
  return JSON.stringify({
    placedBefore: before,
    placedAfter: placed(),
    tier: shot ? shot.tier : null,
    budgetMs: shot ? shot.budgetMs : null,
    firstInkMs: lit.length ? Math.round(lit[0][0] - origin) : null,
    lastInkMs: lit.length ? Math.round(lit[lit.length - 1][0] - origin) : null,
    peakInkPx: Math.max(0, ...samples.map((s) => s[1])),
  })
})()`

/**
 * Answer the card that closes a milestone, wait until the reaction is visibly
 * on the canvas, then interrupt it and time both halves: how long the picture
 * takes to go, and whether the digit that followed landed.
 *
 * The clock starts at the `Enter`, because `Enter` is the keypress whose
 * handler calls `settleNow()`. Timed from the digit after it — as the first cut
 * did — the reported settle is a frame short of what the child experiences.
 * The digit is still pressed, and still has to land, because "never drops or
 * delays the input" is the other half of `Q-04`.
 *
 * It ends by clearing the field. A stray digit left in the entry made every
 * following answer wrong, which is what silently walked the tier-3 probe onto
 * a card with no milestone on it.
 */
const INTERRUPT = `(async () => {
  ${HELPERS}
  globalThis.__dwReaction = null
  const before = placed()
  await answerRight()
  // Let the reaction get going. It is fired from the frame after the verdict
  // paints, so the first two frames are legitimately empty.
  let ink = 0
  for (let i = 0; i < 30 && ink <= 0; i++) { await frame(); ink = inked() }
  const shot = fired()
  if (ink <= 0) return JSON.stringify({ reached: false, placedBefore: before, tier: shot ? shot.tier : null })

  // Interrupt mid-flight, and start the clock on the keypress that settles.
  const started = performance.now()
  key("Enter")
  await frame()
  // …then a digit, which is a real answer keystroke and the thing that must
  // never be dropped or queued behind the animation.
  const digitAt = performance.now()
  key("7")
  const handlerMs = performance.now() - digitAt
  await frame()
  const landed = (answer()?.textContent ?? "").includes("7")

  let cleared = null
  for (let i = 0; i < 30; i++) {
    await frame()
    if (inked() === 0) { cleared = performance.now() - started; break }
  }

  // Leave the field as it was found.
  key("Escape")
  await frame()
  return JSON.stringify({
    reached: true,
    placedBefore: before,
    placedAfter: placed(),
    tier: shot ? shot.tier : null,
    budgetMs: shot ? shot.budgetMs : null,
    peakInkPx: ink,
    keyHandlerMs: Math.round(handlerMs * 100) / 100,
    keyLandedNextFrame: landed,
    entryLeftBehind: (answer()?.textContent ?? "").replace(/\\s/g, ""),
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
    "The ten left the column it came from.",
    "A ten cannot sit in two places. You saw that.",
    "Nothing left over. That is the whole of it.",
    "180 apertures. The light has somewhere to go now.",
    "It closes. Cut stone does, when the order is right.",
    "A shape, where there was a hole.",
    "Stone does not grow back. That one stays cut.",
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

/** Is the control that commits an answer on screen, without scrolling? */
const FOLD = `(() => {
  const plate = [...document.querySelectorAll("button")]
    .find((b) => /^(Check|Next|Done)$/.test((b.textContent ?? "").trim()))
  const box = plate ? plate.getBoundingClientRect() : null
  return JSON.stringify({
    innerHeight: window.innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
    label: plate ? plate.textContent.trim() : null,
    bottomPx: box ? Math.round(box.bottom) : null,
    visible: box ? box.top >= 0 && box.bottom <= window.innerHeight : false,
  })
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
    toPractice: !!document.querySelector('a[href*="practice"]'),
  })
})()`

/** Start a fresh session with the construction seeded to `placed`. */
async function reset(placed) {
  await send("Page.navigate", { url: APP_URL })
  await sleep(600)
  await evaluate(
    `(localStorage.clear(), localStorage.setItem("dynawalla.p1.world", JSON.stringify({ state: { placed: ${String(placed)} }, version: 1 })), 1)`,
  )
  await send("Page.reload", { ignoreCache: true })
  await sleep(2400)
}

try {
  await send("Page.enable")
  await send("Runtime.enable")
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await reset(0)

  // The REDUCED pass is worth nothing if the flag did not take, and a flag that
  // silently stops working is exactly the failure this file exists to catch.
  const reducedInPage = await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches')
  console.log(`reduced motion: asked for ${String(REDUCED)}, page reports ${String(reducedInPage)}`)
  check(reducedInPage === REDUCED, "the reduced-motion flag did not reach the page")

  console.log("── Q-01, the band does not move the work ─────────────────────")
  const play = await json(PLAY(9))
  console.log(play)
  check(play.slateTopSpreadPx <= 1, `the slate moved ${String(play.slateTopSpreadPx)} px vertically`)
  check(play.slateLeftSpreadPx <= 1, `the slate moved ${String(play.slateLeftSpreadPx)} px horizontally`)

  // Every milestone probe below starts from a seeded construction and a fresh
  // reload, so the tier it wants is the tier that is due *and* the once-a-
  // session MECHANISM budget is unspent. Walking there by answering cards is
  // what let one stray keystroke put the probe on the wrong card entirely.
  for (const [seed, tier] of [
    [9, "illuminate"],
    [19, "mechanism"],
  ]) {
    const budget = tier === "mechanism" ? 1800 : 900
    console.log(`\n── lifetime, uninterrupted: ${tier} at ${String(seed + 1)} apertures ──`)
    await reset(seed)
    const life = await json(LIFETIME)
    console.log(life)
    check(life.placedAfter === seed + 1, `the probe landed on ${String(life.placedAfter)} apertures, not ${String(seed + 1)}`)
    check(life.tier === tier, `fired ${String(life.tier)}, not ${tier}`)
    if (!REDUCED && life.tier === tier) {
      const lived = life.lastInkMs
      check(
        lived !== null && lived >= budget * LIFETIME_FLOOR && lived <= budget * LIFETIME_CEILING,
        `${tier} was on screen ${String(lived)} ms of its ${String(budget)} ms budget` +
          ` (${String(Math.round(((lived ?? 0) / budget) * 100))}%)`,
      )
    }
  }

  for (const [seed, tier] of [
    [9, "illuminate"],
    [19, "mechanism"],
  ]) {
    console.log(`\n── Q-04, interrupting the ${tier} at ${String(seed + 1)} apertures ──`)
    await reset(seed)
    const cut = await json(INTERRUPT)
    console.log(cut)
    check(cut.reached === true, "the reaction never reached the canvas")
    check(cut.placedAfter === seed + 1, `the probe landed on ${String(cut.placedAfter)} apertures`)
    check(cut.tier === tier, `interrupted ${String(cut.tier)}, not ${tier}`)
    check(
      cut.clearedMs !== null && cut.clearedMs <= SETTLE_LIMIT_MS,
      `the picture took ${String(cut.clearedMs)} ms to go, past Q-04's ${String(SETTLE_LIMIT_MS)}`,
    )
    check(cut.keyLandedNextFrame === true, "the interrupting keystroke did not land on the next frame")
    check(cut.keyHandlerMs < 50, `the key handler took ${String(cut.keyHandlerMs)} ms`)
  }

  console.log("\n── Q-02, the world's nodes in the DOM ────────────────────────")
  const world = await json(WORLD)
  console.log(world)
  check(world.domNodes !== null && world.domNodes <= 37, `the world drew ${String(world.domNodes)} nodes`)
  check(world.label !== null && /apertures/.test(world.label), "the world has no text alternative")
  check(world.toPractice === true, "the world has no way back to the work")

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
    const band = await json(BAND_HEIGHTS)
    console.log(width, band)
    check(band.movedPx === 0, `the band grew ${String(band.movedPx)} px at ${String(width)} px: ${band.worst}`)
  }

  // The fold. The surface was 878 px tall at every width and the Check plate's
  // bottom edge sat at 833, so at 320 × 568 and 360 × 640 the child scrolled to
  // submit every answer — on the two shortest viewports this app ships to, and
  // nowhere else, which is why nobody saw it.
  console.log("\n── the commit control is above the fold ──────────────────────")
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [768, 1024],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true,
    })
    await evaluate('location.hash = "#/practice", 1')
    await sleep(600)
    const fold = await json(FOLD)
    console.log(`${String(width)}×${String(height)}`, fold)
    check(fold.visible === true, `"${String(fold.label)}" is below the fold at ${String(width)}×${String(height)}`)
  }
} finally {
  socket.close()
  chrome.kill("SIGKILL")
  await sleep(300)
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

if (failures.length > 0) {
  console.log(`\n${String(failures.length)} FAILED`)
  for (const failure of failures) console.log(`  · ${failure}`)
  process.exitCode = 1
} else {
  console.log("\nall probes green")
}
