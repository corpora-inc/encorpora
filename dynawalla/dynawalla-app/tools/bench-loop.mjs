// End-to-end loop bench, in a real browser.
//
// EXPERIENCE_DESIGN budgets the machine's contribution to the loop, and a budget
// nobody measures is a wish. This drives the running app through Chrome DevTools
// Protocol and reports:
//
//   commit → judgement            the app's actual work: judge, diagnose, plan
//                                 — reported **per branch**, because they are
//                                 not the same work at all
//   commit → feedback painted     the child's key to the frame the verdict is on
//   feedback → next card ready    the on-deck problem being in hand
//   generate()                    per-item generation cost
//   slate box, every card         `Q-01`: the units column may not move between
//                                 a two-digit problem and a four-digit one
//   layout shift                  the keypad's box before and after feedback
//   horizontal overflow           at 320, 360, 768 and 1024 CSS px, parked on
//                                 the contrast card — the widest surface here
//
// Two things this used to claim and could not see, both fixed:
//
//   * It answered `top − bottom` on every card, so every `commitToJudgement`
//     sample came from the `seated` branch, which does no diagnosis at all. The
//     driver now plays a mix and buckets each sample by the branch the app took.
//     `diagnosedWithBoard` has a small `count`, and that is the product working:
//     one contrast pair per misconception per session. The high-n measurement of
//     that branch is `bench-generate.mjs`, in Node over thousands of items.
//   * It recorded the keypad's box before and after feedback *within one card*.
//     `Q-01` asks whether the surface moves *between* problems of different digit
//     counts, so the slate's box is now recorded on every card.
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

/**
 * The buggy procedure, implemented here rather than imported: a driver that asks
 * the code under test what the wrong answer is proves only that the code agrees
 * with itself. Regroups down through a run of zeros, writing them as 9s, and
 * never decrements the digit above the run. `null` when the item does not
 * exercise it. Same twenty lines as `drive-locate.mjs`, on purpose.
 */
const BUGGY = `
function borrowAcrossZero(top, bottom) {
  const cols = Math.max(top.length, bottom.length)
  const work = top.padStart(cols, "0").split("").reverse().map(Number)
  const lower = bottom.padStart(cols, "0").split("").reverse().map(Number)
  const out = []
  let crossed = false
  for (let i = 0; i < cols; i++) {
    let a = work[i]
    const b = lower[i]
    if (a < b) {
      let j = i + 1
      while (j < cols && work[j] === 0) { work[j] = 9; j++ }
      if (j >= cols) return null
      if (j > i + 1) crossed = true
      else work[j] -= 1
      a += 10
    }
    out.push(a - b)
  }
  return crossed ? BigInt(out.reverse().join("")) : null
}`

const DRIVER = (cards) => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const digits = (s) => (s.match(/\\d+/g) ?? [])
  const slate = () => document.querySelector(".dw-slate")
  const keypad = () => document.querySelector(".grid.grid-cols-3")
  const well = () => document.querySelector(".dw-verdict-well")
  const key = (k) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))
  const round2 = (n) => Math.round(n * 100) / 100
  ${BUGGY}

  const stats = (xs) => {
    if (xs.length === 0) return { count: 0, p50: null, p95: null, max: null }
    const s = [...xs].sort((a, b) => a - b)
    const at = (p) => s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]
    return { count: s.length, p50: at(50), p95: at(95), max: s[s.length - 1] }
  }

  window.__dwMetrics.reset()
  const judged = () => window.__dwMetrics.samples("commitToJudgement")
  const shifts = []
  const slates = []
  const branches = { seated: [], diagnosedWithBoard: [], struckNoBoard: [] }
  const played = []

  let guard = 0
  let climbing = true
  for (let i = 0; i < ${String(cards)} && guard < ${String(cards)} * 4; i++) {
    guard++
    await frame()
    const el = slate()
    if (!el) {
      // A contrast card. It has no entry; Enter moves on. The old driver
      // never reached one, because it never answered anything wrong.
      key("Enter")
      await sleep(260)
      i--
      continue
    }
    const nums = digits(el.innerText)
    if (nums.length < 2) { await sleep(60); i--; continue }
    const top = BigInt(nums[0]), bottom = BigInt(nums[1])

    // Q-01 is a between-card question, so the box is recorded per card.
    const box = el.getBoundingClientRect()
    slates.push({
      digits: nums[0].length,
      width: round2(box.width),
      right: round2(box.right),
      // A fixed width pins the units column, but it has to actually hold the
      // digits: if 1ch were narrower than the tabular advance, the numerals
      // would spill out of the reservation they are supposed to sit in.
      clipped: el.scrollWidth > el.clientWidth + 0.5,
    })

    // Climb first, then mix. The ladder only moves on correct answers, so a
    // driver that is wrong a third of the time never leaves the two-digit
    // rungs — and Q-01 is a question about two-digit *against* four-digit
    // problems. Once the widest rung is on screen, every branch of the answer
    // path gets sampled: right, the documented bug where the item admits it,
    // and a wrong answer no mal-rule explains.
    if (nums[0].length >= 4) climbing = false
    const correct = top - bottom
    const bug = borrowAcrossZero(nums[0], nums[1])
    const plan = climbing ? 0 : i % 3
    const answer =
      plan === 1 && bug !== null && bug !== correct ? bug
      : plan === 2 ? correct + 7n
      : correct

    const before = keypad().getBoundingClientRect()
    for (const ch of answer.toString()) key(ch)
    await frame()
    const samplesBefore = judged().length
    key("Enter")
    await frame()
    const after = keypad().getBoundingClientRect()
    const shift = round2(Math.abs(after.top - before.top) + Math.abs(after.left - before.left))
    shifts.push(shift)

    const sample = judged()[samplesBefore]
    const seated = (well()?.textContent ?? "").indexOf(String(correct)) === -1
    await sleep(seated ? 520 : 120)
    if (!seated) { key("Enter"); await sleep(260) }
    // The app decides the branch, not the driver. The third bucket is the union
    // of "no rule explains this" and "one does, but its board was spent this
    // session" — indistinguishable from outside, bounded the same either way.
    const branch = seated ? "seated" : slate() === null ? "diagnosedWithBoard" : "struckNoBoard"
    if (sample !== undefined) branches[branch].push(sample)
    played.push(top + "-" + bottom + "=" + answer + " [" + branch + (shift ? " shift " + shift : "") + "]")
  }

  const widths = slates.map((s) => s.width)
  return JSON.stringify({
    cards: played.length,
    sample: played.slice(0, 6),
    commitToJudgement: window.__dwMetrics.report("commitToJudgement"),
    commitToJudgementByBranch: {
      seated: stats(branches.seated),
      diagnosedWithBoard: stats(branches.diagnosedWithBoard),
      struckNoBoard: stats(branches.struckNoBoard),
    },
    commitToFeedback: window.__dwMetrics.report("commitToFeedback"),
    feedbackToReady: window.__dwMetrics.report("feedbackToReady"),
    generate: window.__dwMetrics.report("generate"),
    maxKeypadShiftPx: Math.max(0, ...shifts),
    slate: {
      cards: slates.length,
      digitWidths: [...new Set(slates.map((s) => s.digits))].sort(),
      minWidthPx: Math.min(...widths),
      maxWidthPx: Math.max(...widths),
      widthSpreadPx: round2(Math.max(...widths) - Math.min(...widths)),
      unitsColumnSpreadPx: round2(
        Math.max(...slates.map((s) => s.right)) - Math.min(...slates.map((s) => s.right)),
      ),
      clippedCards: slates.filter((s) => s.clipped).length,
    },
  })
})()`

/**
 * Leave the app parked on the contrast card. The overflow probe used to run
 * wherever an all-correct loop stopped, which is never the contrast pair — two
 * plates of counters, and the widest thing this build draws.
 */
const PARK_ON_CONTRAST = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const digits = (s) => (s.match(/\\d+/g) ?? [])
  const slate = () => document.querySelector(".dw-slate")
  const key = (k) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }))
  ${BUGGY}

  for (let card = 0; card < 80; card++) {
    if (slate() === null) return JSON.stringify({ parked: true, text: document.body.innerText.replace(/\\n+/g, " | ") })
    const nums = digits(slate().innerText)
    if (nums.length < 2) { await sleep(80); continue }
    const correct = BigInt(nums[0]) - BigInt(nums[1])
    const bug = borrowAcrossZero(nums[0], nums[1])
    const answer = bug !== null && bug !== correct ? bug : correct
    for (const ch of answer.toString()) key(ch)
    await sleep(40)
    key("Enter")
    await sleep(260)
    if (answer !== correct) { key("Enter"); await sleep(300) }
  }
  return JSON.stringify({ parked: false })
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

  // A fresh session before parking: the app serves one contrast pair per
  // misconception per session, and the loop above has already spent it, so
  // without this the probe silently measures an ordinary problem card — which
  // is the bug it was written to fix.
  await evaluate("localStorage.clear(), location.reload(), 1")
  await sleep(1500)
  const parked = JSON.parse(await evaluate(PARK_ON_CONTRAST))
  console.log("\n── horizontal overflow, ON THE CONTRAST CARD ─────────────────")
  console.log(`parked on the contrast pair: ${String(parked.parked)}`)
  if (parked.parked) console.log(parked.text)
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
