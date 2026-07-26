// Browser runner: the demo, in a real browser, under real CPU throttling.
//
// Node numbers are honest about the SOLVER but say nothing about the renderer,
// the WASM instantiation path, or what happens when the whole thing runs on a
// tablet. This drives the actual demo in installed Chrome (no browser download
// — `channel: "chrome"`), and uses CDP `Emulation.setCPUThrottlingRate` to
// stand in for the Galaxy Tab A9 we do not have on this desk.
//
// The throttle multiplier is NOT a claim that the tablet is exactly Nx slower.
// It is a way to find the multiplier at which we fall off 60 fps, so the budget
// can be stated as headroom rather than as a single machine's number.
//
//   node bench/run-browser.mjs
//   node bench/run-browser.mjs --throttle 1,4,6,8 --scenes scale,pour,siege
//   node bench/run-browser.mjs --webkit          # if the WebKit build is present
//
// Requires the dev server: `npm run demo` in another shell, or pass --serve.

import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"

const argv = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : d
}
const has = (n) => argv.includes(`--${n}`)

const PORT = Number(arg("port", "1425"))
const BASE = `http://localhost:${PORT}`
const scenes = arg("scenes", "scale,dominoes,chain,gears,pour,siege").split(",")
const throttles = arg("throttle", "1,4,6,8").split(",").map(Number)
const tier = arg("tier", null)

let server = null
if (has("serve")) {
  server = spawn("npx", ["vite", "--config", "demo/vite.config.ts", "demo"], {
    stdio: "ignore",
    detached: false,
  })
  // Vite is fast but not instant, and a failed first navigation looks like a
  // browser problem rather than a timing one.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(500) })
      if (r.ok) break
    } catch {
      /* not up yet */
    }
    await sleep(500)
  }
}

const { chromium, webkit } = await import("playwright")

const engineName = has("webkit") ? "WebKit (JavaScriptCore)" : "Chrome (V8)"
const browser = has("webkit")
  ? await webkit.launch()
  : await chromium.launch({ channel: "chrome" })

const results = []
console.log(`${engineName} — ${await browser.version()}`)
console.log(
  "scene".padEnd(10) +
    "cpu".padEnd(6) +
    "bodies".padEnd(8) +
    "awake".padEnd(7) +
    "stepP99".padEnd(9) +
    "frameP50".padEnd(10) +
    "frameP95".padEnd(10) +
    "fps",
)

for (const scene of scenes) {
  for (const rate of throttles) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    // WebKit has no CDP; only Chromium can be throttled.
    let cdp = null
    if (!has("webkit")) {
      cdp = await ctx.newCDPSession(page)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate })
    } else if (rate !== 1) {
      await ctx.close()
      continue
    }
    const errors = []
    page.on("pageerror", (e) => errors.push(String(e)))
    const url = `${BASE}/?bench=${scene}${tier ? `&tier=${tier}` : ""}`
    await page.goto(url, { waitUntil: "load" })
    let bench = null
    try {
      await page.waitForFunction("globalThis.__bench !== undefined", null, { timeout: 180_000 })
      bench = await page.evaluate("globalThis.__bench")
    } catch {
      console.error(`${scene} @${rate}x: timed out${errors.length ? " — " + errors[0] : ""}`)
    }
    if (bench) {
      results.push({ engine: engineName, cpuThrottle: rate, ...bench })
      console.log(
        scene.padEnd(10) +
          `${rate}x`.padEnd(6) +
          String(bench.bodies).padEnd(8) +
          String(bench.awake).padEnd(7) +
          bench.stepP99Ms.toFixed(3).padEnd(9) +
          bench.frameP50Ms.toFixed(2).padEnd(10) +
          bench.frameP95Ms.toFixed(2).padEnd(10) +
          bench.fpsFromP50.toFixed(1),
      )
    }
    if (errors.length) console.error(`  page errors: ${errors.slice(0, 2).join(" | ")}`)
    await ctx.close()
  }
}

await browser.close()
server?.kill()

const out = arg("json")
if (out) {
  const { writeFileSync } = await import("node:fs")
  writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(`wrote ${out}`)
}
