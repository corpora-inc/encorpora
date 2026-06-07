/**
 * INTEGRATION SMOKE — boots the REAL integrated game.ts (not a piece-mount) and
 * proves the camera+composition+vista+scene-flip wave works together:
 *  1) seeded identity → world boots with ZERO pageerrors (catches createVista /
 *     applyAtmosphere(sky) / sceneSwitch wiring throws)
 *  2) screenshot the low cruise-cam over the relaxed town with the horizon landmark
 *  3) press "t" → live Antigua→Tokyo re-skin over the SAME topology → screenshot
 * Self-contained: spawns + tears down its own vite. Saves /tmp/wp-integ-*.png.
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = 5195
const procs = []
const portOpen = (port) =>
  new Promise((res) => {
    const s = net.connect(port, "127.0.0.1")
    s.once("connect", () => { s.destroy(); res(true) })
    s.once("error", () => res(false))
  })

const vite = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], {
  cwd: packDir, stdio: "pipe", detached: true,
})
procs.push(vite)
vite.stdout.on("data", (d) => process.stdout.write(`[vite] ${d}`))

const cleanup = () => { for (const p of procs) { try { process.kill(-p.pid) } catch {} } }
try {
  for (let i = 0; i < 60 && !(await portOpen(PORT)); i++) await sleep(250)
  const browser = await webkit.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`) })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem(
      "wp:identity:v1",
      JSON.stringify({
        name: { playerId: "player-local", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
        avatar: { base: "body-1", layers: [] },
      }),
    )
  })
  await page.goto(`http://localhost:${PORT}`, { waitUntil: "load" })
  await page.waitForTimeout(2600) // boot Babylon + render the world
  await page.screenshot({ path: "/tmp/wp-integ-antigua.png" })
  const title1 = await page.$eval(".wp-title", (el) => el.textContent).catch(() => "?")

  await page.keyboard.press("t") // flip Antigua → Tokyo
  await page.waitForTimeout(1600) // rebuild atmosphere/vista/worldlook
  await page.screenshot({ path: "/tmp/wp-integ-tokyo.png" })
  const title2 = await page.$eval(".wp-title", (el) => el.textContent).catch(() => "?")

  console.log("\n================ INTEGRATION SMOKE ================")
  console.log("title before flip:", title1)
  console.log("title after  flip:", title2)
  console.log("flip changed title:", title1 !== title2 ? "YES" : "NO")
  console.log("pageerrors:", errors.length ? errors.slice(0, 8) : "none")
  console.log("screens: /tmp/wp-integ-antigua.png, /tmp/wp-integ-tokyo.png")
  console.log(errors.length === 0 && title1 !== title2 ? "PASS" : "CHECK ABOVE")
  console.log("==================================================")
  await browser.close()
} finally {
  cleanup()
}
