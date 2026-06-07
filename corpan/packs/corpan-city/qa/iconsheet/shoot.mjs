// Boot a vite dev server on a unique port, render the icon contact sheet in
// WebKit (Playwright), screenshot full sheet + a 24px-only sheet, tear down.
import { createServer } from "vite"
import { webkit } from "playwright"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "../..")
const PORT = 5293

const server = await createServer({
  root: projectRoot,
  configFile: path.join(projectRoot, "vite.config.ts"),
  server: { port: PORT, strictPort: true },
  optimizeDeps: { entries: ["qa/iconsheet/sheet.ts"] },
})
await server.listen()
const url = `http://localhost:${PORT}/qa/iconsheet/index.html`
console.log("[shoot] serving", url)

const browser = await webkit.launch()
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1100, height: 900 } })
page.on("console", (m) => console.log("  [page]", m.text()))
page.on("pageerror", (e) => console.error("  [pageerror]", e.message))

await page.goto(url, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__iconsheetReady === true, { timeout: 20000 })
await page.waitForTimeout(400)

await page.screenshot({ path: "/tmp/wp-icons-contactsheet.png", fullPage: true })
console.log("[shoot] wrote /tmp/wp-icons-contactsheet.png")

// 24px-only HUD-legibility sheet: hide the 48px canvas in every cell.
await page.addStyleTag({ content: ".icons canvas:nth-child(2){display:none}" })
await page.waitForTimeout(150)
await page.screenshot({ path: "/tmp/wp-icons-24px.png", fullPage: true })
console.log("[shoot] wrote /tmp/wp-icons-24px.png")

await browser.close()
await server.close()
console.log("[shoot] done")
process.exit(0)
