// Capture the demo at rest and mid-reaction, at device pixel ratio.
//
//   npx vite preview && node bench/shot.mjs [outdir]
//
// Code review cannot see that a scene looks wrong. The repo's own experience
// doc says as much and the program gates on committed images rather than on
// diffs. These are those images.

import { spawn } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const URL_ = process.env.DW_URL ?? "http://127.0.0.1:4173/"
const OUT = process.argv[2] ?? "docs/shots"
const PORT = Number(process.env.DW_CDP_PORT ?? 9445)
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdirSync(OUT, { recursive: true })
const profile = mkdtempSync(path.join(tmpdir(), "dw-shot-"))
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${String(PORT)}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-extensions",
    "--hide-scrollbars",
    "--mute-audio",
    "--enable-gpu",
    "--use-angle=metal",
    "--window-size=1024,768",
  ],
  { stdio: "ignore" },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
let msgId = 0
const pending = new Map()
const send = (method, params = {}) => {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((res, rej) => pending.set(id, { res, rej }))
}
const evalJs = async (e) => {
  const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })
  return r.result?.value
}

try {
  let wsUrl
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${String(PORT)}/json/list`).then((r) => r.json())
      wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl
    } catch {
      /* not up */
    }
    if (!wsUrl) await sleep(150)
  }
  ws = new WebSocket(wsUrl)
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) rej(new Error(m.error.message))
      else res(m.result)
    }
  })
  await new Promise((r) => ws.addEventListener("open", r, { once: true }))
  await send("Page.enable")
  await send("Runtime.enable")
  await send("Log.enable")

  const errors = []
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
      errors.push(m.params.entry.text)
    }
  })

  const shots = [
    { name: "01-tablet-rest", w: 1024, h: 768, dpr: 2, after: null, wait: 1500 },
    { name: "02-tablet-snap", w: 1024, h: 768, dpr: 2, after: "snap", wait: 90 },
    { name: "03-tablet-bloom", w: 1024, h: 768, dpr: 2, after: "bloom", wait: 260 },
    { name: "04-tablet-ascend", w: 1024, h: 768, dpr: 2, after: "ascend", wait: 420 },
    { name: "05-phone-rest", w: 390, h: 844, dpr: 3, after: null, wait: 900 },
    { name: "06-phone-pop", w: 390, h: 844, dpr: 3, after: "pop", wait: 120 },
  ]

  for (const s of shots) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: s.w,
      height: s.h,
      deviceScaleFactor: s.dpr,
      mobile: true,
    })
    await send("Page.navigate", { url: URL_ })
    for (let i = 0; i < 60; i++) {
      if (await evalJs("!!window.__dwFeelReady")) break
      await sleep(150)
    }
    await sleep(1200)
    if (s.after) {
      await evalJs(`window.__dwProbe.fire(${JSON.stringify(s.after)})`)
      await sleep(s.wait)
    }
    const { data } = await send("Page.captureScreenshot", { format: "png", fromSurface: true })
    const file = path.join(OUT, `${s.name}.png`)
    writeFileSync(file, Buffer.from(data, "base64"))
    console.log(`${file}  ${String(s.w)}x${String(s.h)} @${String(s.dpr)}x`)
  }

  if (errors.length) {
    console.log("\nCONSOLE ERRORS:")
    for (const e of errors) console.log("  " + e)
  } else {
    console.log("\nno console errors")
  }
} finally {
  try {
    ws?.close()
  } catch {
    /* ignore */
  }
  chrome.kill()
  await sleep(300)
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
  } catch {
    /* harmless */
  }
}
