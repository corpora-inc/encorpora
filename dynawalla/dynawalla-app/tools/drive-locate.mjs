// Drive the real UI to the contrast pair, and photograph it.
//
// Nothing here reaches into the store, sets a flag, or calls a bypass hook. It
// reads the numbers off the slate, presses keys at the window the way a keyboard
// does, and climbs the ladder by answering correctly — the same path a child
// takes — until a problem with a run of zeros in the minuend appears. Then it
// answers with the *borrow-across-zero* result: the correct difference plus the
// place value of the zero run, which is the answer a child gives who regrouped
// all the way down and never gave the thousand up.
//
// If the contrast pair does not appear on the next card, this exits non-zero.
// A harness that proves the diagnosis by asking the diagnosis code proves
// nothing about the screen.
//
//   npm run dev                  # in another shell
//   node tools/drive-locate.mjs [outDir]
//
// Screenshots land in `outDir` (default: a temp dir, path printed).

import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const APP_URL = process.env.DW_URL ?? "http://127.0.0.1:1423/#/practice"
const OUT = process.argv[2] ?? mkdtempSync(path.join(tmpdir(), "dw-shots-"))
const PORT = 9334
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdirSync(OUT, { recursive: true })
const profile = mkdtempSync(path.join(tmpdir(), "dw-drive-"))
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
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "page threw")
  }
  return result.result.value
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
  const file = path.join(OUT, `${name}.png`)
  writeFileSync(file, Buffer.from(data, "base64"))
  return file
}

const PAGE_HELPERS = `
window.__dw = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  frame: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  key: (k) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })),
  slate: () => document.querySelector(".dw-slate"),
  board: () => document.querySelector(".dw-present p.numeral"),
  text: () => document.body.innerText.replace(/\\n+/g, " | "),
  problem: () => {
    const el = document.querySelector(".dw-slate")
    if (!el) return null
    const nums = el.innerText.match(/\\d+/g)
    return nums && nums.length >= 2 ? { top: nums[0], bottom: nums[1] } : null
  },
}
"ok"`

/**
 * The answer a child writes who regroups all the way down through a run of
 * zeros — turning them into 9s — and never decrements the digit above the run.
 *
 * Written out here rather than imported from the curriculum on purpose: a driver
 * that asks the code under test what the wrong answer is proves only that the
 * code agrees with itself. This is the procedure from the documented bug,
 * implemented independently, and `null` when this problem does not exercise it —
 * a borrow that travels only one column is ordinary regrouping, not this.
 */
function borrowAcrossZeroAnswer(top, bottom) {
  const cols = Math.max(top.length, bottom.length)
  const work = top.padStart(cols, "0").split("").reverse().map(Number)
  const lower = bottom.padStart(cols, "0").split("").reverse().map(Number)
  const out = []
  let crossedZero = false

  for (let i = 0; i < cols; i++) {
    let a = work[i]
    const b = lower[i]
    if (a < b) {
      let j = i + 1
      while (j < cols && work[j] === 0) {
        work[j] = 9
        j++
      }
      if (j >= cols) return null
      if (j > i + 1) crossedZero = true
      else work[j] -= 1
      a += 10
    }
    out.push(a - b)
  }
  if (!crossedZero) return null

  const buggy = BigInt(out.reverse().join(""))
  const correct = BigInt(top) - BigInt(bottom)
  return { correct, buggy, surplus: buggy - correct }
}

let failure = null

async function run() {
  await send("Page.enable")
  await send("Runtime.enable")
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send("Page.navigate", { url: APP_URL })
  await sleep(1800)
  await evaluate("localStorage.clear(), location.reload(), 1")
  await sleep(1500)
  await evaluate(PAGE_HELPERS)

  console.log(`first problem: ${JSON.stringify(await evaluate("JSON.stringify(window.__dw.problem())"))}`)
  console.log(`screenshot: ${await shot("01-problem")}`)

  // Climb until a zero-run minuend appears. Answering correctly is the only way
  // up: the ladder moves on four correct answers a rung.
  let target = null
  for (let card = 0; card < 60 && target === null; card++) {
    const problem = JSON.parse(await evaluate("JSON.stringify(window.__dw.problem())"))
    if (problem === null) {
      await evaluate("window.__dw.key('Enter')")
      await sleep(200)
      continue
    }
    const candidate = borrowAcrossZeroAnswer(problem.top, problem.bottom)
    if (candidate !== null) {
      target = { problem, ...candidate }
      break
    }
    const answer = (BigInt(problem.top) - BigInt(problem.bottom)).toString()
    await evaluate(
      `(async () => { for (const c of ${JSON.stringify(answer)}) window.__dw.key(c); await window.__dw.frame(); window.__dw.key('Enter'); await window.__dw.sleep(520) })()`,
    )
  }

  if (target === null) throw new Error("never reached a problem with a zero run in the minuend")

  console.log(
    `\nreached ${target.problem.top} − ${target.problem.bottom}` +
      `  correct ${target.correct}  answering ${target.buggy} (= correct + ${target.surplus})`,
  )
  console.log(`screenshot: ${await shot("02-across-zero-problem")}`)

  await evaluate(
    `(async () => { for (const c of ${JSON.stringify(target.buggy.toString())}) window.__dw.key(c); await window.__dw.frame() })()`,
  )
  console.log(`screenshot: ${await shot("03-answer-typed")}`)

  await evaluate("(async () => { window.__dw.key('Enter'); await window.__dw.sleep(120) })()")
  const verdict = await evaluate("window.__dw.text()")
  console.log(`\nverdict screen: ${verdict}`)
  console.log(`screenshot: ${await shot("04-struck")}`)

  await evaluate("(async () => { window.__dw.key('Enter'); await window.__dw.sleep(200) })()")
  const contrast = await evaluate("window.__dw.text()")
  console.log(`\ncontrast card: ${contrast}`)
  console.log(`screenshot: ${await shot("05-contrast-pair")}`)

  const expectedSum = (target.buggy + BigInt(target.problem.bottom)).toString()
  const ok =
    contrast.includes("Put it back together") &&
    contrast.includes(expectedSum) &&
    contrast.includes(target.problem.top)
  if (!ok) throw new Error(`the contrast pair did not appear on the next card: ${contrast}`)
  console.log(
    `\nOK  the board shows ${target.buggy} + ${target.problem.bottom} = ${expectedSum}, ` +
      `against ${target.problem.top}`,
  )

  await evaluate("(async () => { window.__dw.key('Enter'); await window.__dw.sleep(250) })()")
  const repair = JSON.parse(await evaluate("JSON.stringify(window.__dw.problem())"))
  console.log(`\nrepair card: ${JSON.stringify(repair)}`)
  console.log(`screenshot: ${await shot("06-repair")}`)

  if (repair === null) throw new Error("no problem on the card after the contrast pair")
  const repairable = borrowAcrossZeroAnswer(repair.top, repair.bottom)
  if (repairable === null) {
    throw new Error(
      `the repair item ${repair.top} − ${repair.bottom} does not borrow through a zero — ` +
        "it cannot test the step that just broke",
    )
  }
  console.log(
    `OK  the repair item borrows through a zero: ${repair.top} − ${repair.bottom}, ` +
      `the same step, correct ${repairable.correct}`,
  )
}

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

process.exitCode = failure === null ? 0 : 1
