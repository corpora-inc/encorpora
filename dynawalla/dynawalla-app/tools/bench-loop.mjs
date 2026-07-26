// End-to-end loop bench, in a real browser.
//
// EXPERIENCE_DESIGN budgets the machine's contribution to the loop, and a budget
// nobody measures is a wish. This drives the running app through Chrome DevTools
// Protocol and reports:
//
//   commit → judgement            the app's actual work: judge, diagnose, plan
//   commit → feedback painted     the child's key to the frame the verdict is on
//   feedback → next card ready    the on-deck problem being in hand
//   generate()                    per-item generation cost
//   layout shift                  the keypad's box before and after feedback
//   horizontal overflow           at 320, 360, 768 and 1024 CSS px
//
// Note what `commit → feedback painted` can and cannot say. It is probed with a
// double `requestAnimationFrame`, so its floor is one compositor frame — 16.7 ms
// at 60 Hz — whatever the app does. A p50 of ~16.6 ms therefore reads "the
// verdict is on the next frame, every time", not "16.6 ms of work". The work is
// `commit → judgement`.
//
// It uses `requestAnimationFrame` twice to find the painted frame, so the page
// must actually be rendering: a backgrounded tab never fires rAF and would
// report nothing rather than something wrong. Headless Chrome renders.
//
//   npm run dev                       # in another shell
//   node tools/bench-loop.mjs [cards]
//
// This is a developer-machine number. `Q-01` is the same measurement on a Galaxy
// Tab A9 and is a `[device]` item no script can close.

import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const APP_URL = process.env.DW_URL ?? "http://127.0.0.1:1423/#/practice"
const CARDS = Number(process.argv[2] ?? 24)
const PORT = 9333

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const profile = mkdtempSync(path.join(tmpdir(), "dw-bench-"))

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${String(PORT)}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-extensions",
    "--hide-scrollbars",
    "--window-size=390,844",
  ],
  { stdio: "ignore" },
)

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
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "page threw")
  }
  return result.result.value
}

async function widthProbe(width) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await sleep(250)
  return evaluate(`(() => {
    const doc = document.documentElement
    const overflow = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 0.5)
      .map((el) => el.className || el.tagName)
    return JSON.stringify({
      width: ${String(width)},
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth,
      offenders: overflow.slice(0, 5),
    })
  })()`)
}

const DRIVER = (cards) => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const digits = (s) => (s.match(/\\d+/g) ?? [])
  const slate = () => document.querySelector(".dw-slate")
  const keypad = () => document.querySelector(".grid.grid-cols-3")
  const key = (k) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))

  window.__dwMetrics.reset()
  const shifts = []
  const played = []

  for (let i = 0; i < ${String(cards)}; i++) {
    await frame()
    const el = slate()
    if (!el) { await sleep(60); continue }
    const nums = digits(el.innerText)
    if (nums.length < 2) { await sleep(60); continue }
    const top = BigInt(nums[0]), bottom = BigInt(nums[1])
    const answer = (top - bottom).toString()

    const before = keypad().getBoundingClientRect()
    for (const ch of answer) key(ch)
    await frame()
    key("Enter")
    await frame()
    const after = keypad().getBoundingClientRect()
    shifts.push(Math.round((Math.abs(after.top - before.top) + Math.abs(after.left - before.left)) * 100) / 100)
    played.push(top + "-" + bottom + "=" + answer)
    await sleep(480)
  }

  return JSON.stringify({
    cards: played.length,
    sample: played.slice(0, 4),
    commitToJudgement: window.__dwMetrics.report("commitToJudgement"),
    commitToFeedback: window.__dwMetrics.report("commitToFeedback"),
    feedbackToReady: window.__dwMetrics.report("feedbackToReady"),
    generate: window.__dwMetrics.report("generate"),
    maxKeypadShiftPx: Math.max(0, ...shifts),
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
  await sleep(2000)
  await evaluate("localStorage.clear(), location.reload(), 1")
  await sleep(1500)

  const loop = JSON.parse(await evaluate(DRIVER(CARDS)))
  console.log("── loop, 390 px viewport ─────────────────────────────────────")
  console.log(JSON.stringify(loop, null, 1))

  console.log("\n── horizontal overflow ───────────────────────────────────────")
  for (const width of [320, 360, 768, 1024]) {
    console.log(await widthProbe(width))
  }
} finally {
  socket.close()
  chrome.kill()
  // Chrome is still flushing its profile as it exits, so a bare `rmSync` races
  // it and throws ENOTEMPTY over a temp directory nobody cares about.
  await sleep(300)
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
