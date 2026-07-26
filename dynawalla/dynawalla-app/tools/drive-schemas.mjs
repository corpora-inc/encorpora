// Drive every answer schema and every representation in a real browser, and
// photograph them.
//
// Nothing here reaches into a store, sets a flag or calls a bypass hook: it
// presses keys at the window and taps controls the way a finger does, reads the
// entry model's committed value back off the DOM, and fails when the screen
// disagrees with the model.
//
// It exists because bugs of this class are found only by looking — a rule
// invisible in dark mode, an Enter that trapped a keyboard user, a mark row half
// a cell off the digits it annotates. No test in this repository catches any of
// them.
//
//   npm run dev                       # in another shell
//   node tools/drive-schemas.mjs [outDir]

import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const APP_URL = process.env.DW_URL ?? "http://127.0.0.1:1423/preview.html"
const OUT = process.argv[2] ?? mkdtempSync(path.join(tmpdir(), "dw-schemas-"))
const PORT = 9335
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdirSync(OUT, { recursive: true })
const profile = mkdtempSync(path.join(tmpdir(), "dw-schemas-profile-"))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${String(PORT)}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-extensions",
    "--hide-scrollbars",
    "--window-size=390,900",
  ],
  { stdio: "ignore" },
)

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
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "page threw")
  return r.result.value
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
  const file = path.join(OUT, `${name}.png`)
  writeFileSync(file, Buffer.from(data, "base64"))
  return file
}

const HELPERS = `
window.__dw = {
  frame: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  key: (k) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })),
  section: (id) => document.querySelector('[data-case="' + id + '"]'),
  focusCase: (id) =>
    window.__dw.section(id).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })),
  type: async (id, text) => {
    // A frame between the tap and the keys: the page routes a window keypress to
    // whichever specimen was last touched, and that is React state, so keys sent
    // in the same tick as the tap go to the *previous* specimen.
    window.__dw.focusCase(id);
    await window.__dw.frame();
    for (const c of text) window.__dw.key(c);
    await window.__dw.frame();
  },
  state: (id) => {
    const el = window.__dw.section(id);
    return el === null ? null : { complete: el.dataset.complete, value: el.dataset.value };
  },
  label: (id, sel) => window.__dw.section(id)?.querySelector(sel)?.getAttribute("aria-label") ?? null,
  cells: (id) =>
    [...(window.__dw.section(id)?.querySelectorAll("[data-dw-entry]") ?? [])].map((el) => ({
      label: el.getAttribute("aria-label"),
      text: el.textContent.trim(),
      current: el.getAttribute("aria-current") === "true",
      checked: el.getAttribute("aria-checked"),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
    })),
  overflow: () => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }),
  barWidth: (id) =>
    window.__dw.section(id)?.querySelector(".border-line-strong")?.getBoundingClientRect().width ?? 0,
};
"ok"`

const problems = []
const note = (line) => console.log(line)
const check = (ok, message) => {
  if (!ok) problems.push(message)
  console.log(`${ok ? "OK  " : "FAIL"} ${message}`)
}

const resize = (width, height) =>
  send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true })

async function run() {
  await send("Page.enable")
  await send("Runtime.enable")
  await resize(390, 900)
  await send("Page.navigate", { url: APP_URL })
  await sleep(2500)
  await evaluate(HELPERS)

  note(
    `cases on the page: ${await evaluate("JSON.stringify([...document.querySelectorAll('[data-case]')].map((e) => e.dataset.case))")}`,
  )

  // ── decimal: the separator is a key, and the round trip holds ─────────────
  await evaluate("window.__dw.type('decimal-tenths', '31.5')")
  let state = await evaluate("JSON.stringify(window.__dw.state('decimal-tenths'))")
  note(`decimal-tenths after typing 31.5 → ${state}`)
  check(JSON.parse(state).value.includes('"n":"63"'), "31.5 parses to the exact rational 63/2")
  check(JSON.parse(state).complete === "true", "31.5 is committable")

  await evaluate("window.__dw.type('decimal-hundredths', '12.75')")
  state = await evaluate("JSON.stringify(window.__dw.state('decimal-hundredths'))")
  note(`decimal-hundredths after typing 12.75 → ${state}`)
  check(JSON.parse(state).value.includes('"n":"51"'), "12.75 parses to 51/4")

  // ── fraction: two cells over a bar, both named ────────────────────────────
  await evaluate("window.__dw.type('fraction', '3/4')")
  state = await evaluate("JSON.stringify(window.__dw.state('fraction'))")
  note(`fraction after typing 3/4 → ${state}`)
  check(
    JSON.parse(state).value.includes('"num":"3"') && JSON.parse(state).value.includes('"den":"4"'),
    "3/4 is written down as 3 over 4, not simplified and not a decimal",
  )
  let cells = JSON.parse(await evaluate("JSON.stringify(window.__dw.cells('fraction'))"))
  note(`fraction cells: ${JSON.stringify(cells)}`)
  check(
    cells.length === 2 && cells[0].label === "Numerator" && cells[1].label === "Denominator",
    "both fraction cells are named",
  )
  check(cells.some((c) => c.current), "one cell is marked as the one the keypad writes into")
  check(
    cells.every((c) => c.w >= 30 && c.h >= 40),
    `both cells are a target a child can hit (${cells.map((c) => `${c.w}x${c.h}`).join(", ")})`,
  )

  await evaluate("window.__dw.type('mixed', '2/1/3')")
  cells = JSON.parse(await evaluate("JSON.stringify(window.__dw.cells('mixed'))"))
  note(`mixed cells: ${JSON.stringify(cells.map((c) => `${c.label}=${c.text}`))}`)
  check(
    cells.length === 3 && cells.map((c) => c.text).join("|") === "2|1|3",
    "a mixed number is whole, numerator, denominator, in that order",
  )

  // ── column grid: typed units-first, read most-significant-first ───────────
  await evaluate("window.__dw.type('column-borrow', '3022')")
  state = await evaluate("JSON.stringify(window.__dw.state('column-borrow'))")
  note(`column-borrow after typing 3022 (units first) → ${state}`)
  check(JSON.parse(state).value.includes('"n":"2203"'), "the grid reads 2203, the answer to 5001 − 2798")
  cells = JSON.parse(await evaluate("JSON.stringify(window.__dw.cells('column-borrow'))"))
  note(`column cells: ${JSON.stringify(cells.map((c) => `${c.label}:${c.text || "_"}`))}`)
  check(
    cells.filter((c) => c.h > 40).map((c) => c.label).join(",") === "1000,100,10,1",
    "the digit cells are named by their place, most significant first",
  )

  // ── choice: a radio group, and chosen is not carried by colour ────────────
  await evaluate(
    "(async () => { const b = window.__dw.section('choice').querySelectorAll('[role=radio]')[2];" +
      " b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await window.__dw.frame() })()",
  )

  state = await evaluate("JSON.stringify(window.__dw.state('choice'))")
  note(`choice after tapping the third option → ${state}`)
  check(JSON.parse(state).value.includes('"index":2'), "the third option is the answer")
  cells = JSON.parse(await evaluate("JSON.stringify(window.__dw.cells('choice'))"))
  note(`choice options: ${JSON.stringify(cells.map((c) => `${c.text}:${c.checked}`))}`)
  check(
    cells.filter((c) => c.checked === "true").length === 1,
    "exactly one option is aria-checked",
  )
  check(
    cells.every((c) => c.h >= 44),
    `every option is a target a child can hit (${cells.map((c) => c.h).join(", ")})`,
  )

  // ── representations: the text alternative is the whole meaning ────────────
  for (const [id, expected] of [
    ["line-quarters", "Marked at 3/4"],
    ["line-thirds", "Marked at 1"],
    ["line-wholes", "Marked at 5"],
    ["balance-level", "The pans are level."],
    ["balance-left", "The left pan is lower."],
    ["balance-right", "The right pan is lower."],
  ]) {
    const label = await evaluate(`window.__dw.label(${JSON.stringify(id)}, '[role=img]')`)
    note(`${id}: ${JSON.stringify(label)}`)
    check(label !== null && label.includes(expected), `${id} says "${expected}"`)
  }

  const unrenderable = await evaluate("window.__dw.section('unrenderable').querySelectorAll('*').length")
  note(`unrenderable section child elements: ${String(unrenderable)}`)
  check(unrenderable <= 1, "a representation nothing can draw draws nothing, rather than guessing")

  console.log(`\nscreenshot: ${await shot("01-light-390")}`)

  // ── the Enter trap ───────────────────────────────────────────────────────
  const trapped = await evaluate(`(() => {
    window.__dw.section('fraction').querySelector('[data-dw-entry]').focus();
    const a = document.activeElement;
    return { tag: a.tagName, entry: a.hasAttribute('data-dw-entry') };
  })()`)
  note(`focused cell: ${JSON.stringify(trapped)}`)
  check(
    trapped.tag === "BUTTON" && trapped.entry === true,
    "an answer cell is a real focusable control, and is marked as part of the answer",
  )

  // ── 320 px, both themes ──────────────────────────────────────────────────
  await resize(320, 640)
  await sleep(400)
  let overflow = JSON.parse(await evaluate("JSON.stringify(window.__dw.overflow())"))
  note(`320 px: document ${String(overflow.doc)} px in a ${String(overflow.win)} px window`)
  check(overflow.doc <= overflow.win, "nothing overflows sideways at 320 px")
  console.log(`screenshot: ${await shot("02-light-320")}`)

  await evaluate(
    "document.querySelector('[data-preview=theme]').click(), document.documentElement.className",
  )
  await sleep(300)
  console.log(`screenshot: ${await shot("03-dark-320")}`)

  // A line drawn in `line-cut` is the same basalt as the ground in dark, which
  // is how the subtraction bar once vanished entirely.
  const bar = await evaluate("window.__dw.barWidth('fraction')")
  note(`dark: the fraction bar is ${String(bar)} px wide`)
  check(bar > 0, "the fraction bar is still drawn in dark")

  await resize(390, 900)
  await sleep(300)
  console.log(`screenshot: ${await shot("04-dark-390")}`)

  // ── reduced motion ───────────────────────────────────────────────────────
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  })
  await sleep(300)
  const beam = await evaluate(
    "getComputedStyle(window.__dw.section('balance-left').querySelector('.dw-beam')).transitionDuration",
  )
  note(`reduced motion: the beam's transition-duration is ${beam}`)
  // `tokens.css` clamps every transition to 1 ms `!important` here, outranking
  // `.dw-beam { transition: none }`. Either way there is no travel to see.
  check(Number.parseFloat(beam) <= 0.001, "the beam arrives tilted rather than swinging to it")
  console.log(`screenshot: ${await shot("05-reduced-motion")}`)

  if (problems.length > 0) {
    throw new Error(`${String(problems.length)} check(s) failed:\n  ${problems.join("\n  ")}`)
  }
}

let failure = null
try {
  await run()
} catch (error) {
  failure = error
  console.error(`\nFAILED: ${error.message}`)
} finally {
  socket.close()
  chrome.kill()
  await sleep(300)
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

console.log(`\nscreenshots in ${OUT}`)
process.exitCode = failure === null ? 0 : 1
