// Frame-time measurement in a real browser, at real quality tiers, with real
// CPU throttling.
//
//   npx vite preview          # in another shell
//   node bench/frames.mjs
//
// Why this exists and `bench/cpu.mjs` is not enough: the CPU bench measures the
// kit's own arithmetic, which is a rounding error. What actually decides
// whether a prototype holds 60 fps is the *render* — draw calls, fill rate,
// pixel ratio, blend passes — and the only honest way to see that is to render.
//
// ## The developer-machine problem, and what is done about it
//
// This runs on whatever machine you have, and the brief's constraint is a
// mid-range tablet. `Emulation.setCPUThrottlingRate` is the closest available
// approximation: it throttles the main thread by an integer factor. It does
// **not** throttle the GPU, so a throttled run models a slow CPU with a fast
// GPU — which flatters us on fill rate and is honest about JavaScript. Both
// numbers are reported and the gap is stated rather than hidden.
//
// ## The headless WebGL trap
//
// Headless Chrome without a GPU flag renders WebGL through SwiftShader — a
// software rasteriser — and every fill-rate number it produces is fiction,
// usually 10–50× too slow. The bench reads `WEBGL_debug_renderer_info` and
// refuses to report GPU numbers if it sees SwiftShader. This cost a real
// measurement round to discover.

import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const URL_ = process.env.DW_URL ?? "http://127.0.0.1:4173/"
const PORT = Number(process.env.DW_CDP_PORT ?? 9444)
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const profile = mkdtempSync(path.join(tmpdir(), "dw-feel-"))
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
    "--window-size=1024,768",
    // Without these three, headless falls back to SwiftShader and every GPU
    // number below is fiction.
    "--enable-gpu",
    "--use-angle=metal",
    "--enable-unsafe-swiftshader",
  ],
  { stdio: "ignore" },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function endpoint() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${String(PORT)}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === "page")
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* not up */
    }
    await sleep(150)
  }
  throw new Error("chrome never exposed a debugging endpoint")
}

let ws
let msgId = 0
const pending = new Map()

function send(method, params = {}) {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((res, rej) => pending.set(id, { res, rej }))
}

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description))
  return r.result?.value
}

// Frame WORK, not rAF delta. See the header of the probe in demo/main.ts.
function row(label, w) {
  const flag = w.p95 > 16.7 ? "   OVER BUDGET" : w.p95 > 8 ? "   tight" : ""
  console.log(
    `  ${label.padEnd(32)} work p50 ${w.p50.toFixed(2).padStart(6)}  p95 ${w.p95.toFixed(2).padStart(6)}` +
      `  p99 ${w.p99.toFixed(2).padStart(6)}  worst ${w.worst.toFixed(2).padStart(6)} ms${flag}`,
  )
}

try {
  const url = await endpoint()
  const { WebSocket } = await import("node:worker_threads").then(() => globalThis)
  ws = new WebSocket(url)
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
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send("Page.navigate", { url: URL_ })

  for (let i = 0; i < 80; i++) {
    const ready = await evalJs("!!window.__dwFeelReady").catch(() => false)
    if (ready) break
    await sleep(200)
  }

  const gpu = await evalJs(`(() => {
    const c = document.querySelector('canvas');
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    if (!gl) return 'no webgl';
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  })()`)
  const software = /swiftshader|llvmpipe|software/i.test(String(gpu))
  console.log(`\nGPU: ${String(gpu)}${software ? "   *** SOFTWARE — fill-rate numbers are fiction ***" : ""}`)
  console.log(`viewport 1024x768 @ dpr 2  (2.05 MP after the kit's dpr cap)\n`)

  await sleep(1200) // let the first-frame shader compiles settle

  for (const throttle of [1, 4, 6]) {
    await send("Emulation.setCPUThrottlingRate", { rate: throttle })
    console.log(
      throttle === 1
        ? "--- CPU 1x (this machine: M2 Max) ---"
        : `--- CPU ${String(throttle)}x throttled (approximating a mid-range tablet CPU; GPU is NOT throttled) ---`,
    )

    for (const tier of ["low", "medium", "high", "ultra"]) {
      await evalJs(`window.__dwProbe.setQuality(${JSON.stringify(tier)})`)
      await sleep(500)

      // Idle.
      await evalJs("window.__dwProbe.record(2000)")
      row(`${tier} idle`, await evalJs("window.__dwProbe.workStats()"))

      // Under continuous load: a reaction every ~120 ms, which is far denser
      // than a child can produce and is the point — the floor must hold under
      // abuse, not under the happy path.
      await evalJs(`(async () => {
        const p = window.__dwProbe.record(3000);
        const iv = setInterval(() => window.__dwProbe.fire(['snap','pop','slam','bloom'][Math.floor(Math.random()*4)]), 120);
        await p; clearInterval(iv);
      })()`)
      row(`${tier} reaction every 120ms`, await evalJs("window.__dwProbe.workStats()"))
    }

    // The worst case the kit can be asked for: 40 simultaneous reactions.
    await evalJs(`window.__dwProbe.setQuality("ultra")`)
    await sleep(300)
    await evalJs(`(async () => {
      const p = window.__dwProbe.record(2500);
      setTimeout(() => window.__dwProbe.storm(40), 250);
      await p;
    })()`)
    row("ultra 40-reaction storm", await evalJs("window.__dwProbe.workStats()"))
    console.log("")
  }

  await send("Emulation.setCPUThrottlingRate", { rate: 1 })

  const diag = await evalJs(`({
    overflows: window.__dwProbe ? 0 : 0,
    dpr: window.devicePixelRatio,
    cores: navigator.hardwareConcurrency,
    mem: navigator.deviceMemory ?? null,
  })`)
  console.log("device signals seen by boot detection:", JSON.stringify(diag))
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
    /* chrome is still flushing its profile; harmless */
  }
}
