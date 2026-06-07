/**
 * WebKit verify driver for the Phone. Boots vite, screenshots the FAB, then opens
 * the phone on the Music + Things tabs at phone AND desktop widths.
 *
 *   node qa/phone-verify.mjs
 *
 * → /tmp/wp-phone-fab.png, /tmp/wp-phone-music.png, /tmp/wp-phone-things.png,
 *   /tmp/wp-phone-desktop.png
 */
import { createServer } from "vite"
import { webkit } from "playwright"

const PORT = 5193

async function main() {
  const server = await createServer({
    root: process.cwd(),
    server: { port: PORT, strictPort: true },
    logLevel: "warn",
  })
  await server.listen()
  const url = `http://localhost:${PORT}/qa/phone-verify.html`
  console.log(`[phone-verify] vite up at ${url}`)

  const browser = await webkit.launch()
  const errors = []

  // Phone width.
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } })
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.goto(url, { waitUntil: "networkidle" })
  await page.waitForSelector(".wp-phone-fab", { timeout: 8000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: "/tmp/wp-phone-fab.png" })
  console.log("[phone-verify] /tmp/wp-phone-fab.png (FAB closed)")

  await page.click(".wp-phone-fab")
  await page.waitForSelector(".wp-phone-root.wp-phone-open", { timeout: 4000 })
  await page.waitForTimeout(400)
  // Default app = Things; switch to Music for the music shot.
  await page.click('.wp-phone-tab[data-app-id="music"]')
  await page.waitForSelector(".wp-phone-now", { timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: "/tmp/wp-phone-music.png" })
  console.log("[phone-verify] /tmp/wp-phone-music.png")

  await page.click('.wp-phone-tab[data-app-id="things"]')
  await page.waitForSelector(".wp-inv", { timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: "/tmp/wp-phone-things.png" })
  console.log("[phone-verify] /tmp/wp-phone-things.png")

  // Desktop width — the docked card.
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  desk.on("pageerror", (e) => errors.push(String(e)))
  await desk.goto(url, { waitUntil: "networkidle" })
  await desk.waitForSelector(".wp-phone-fab", { timeout: 8000 })
  await desk.click(".wp-phone-fab")
  await desk.waitForSelector(".wp-phone-root.wp-phone-open", { timeout: 4000 })
  await desk.click('.wp-phone-tab[data-app-id="music"]')
  await desk.waitForTimeout(400)
  await desk.screenshot({ path: "/tmp/wp-phone-desktop.png" })
  console.log("[phone-verify] /tmp/wp-phone-desktop.png (docked card)")

  await browser.close()
  await server.close()

  if (errors.length) {
    console.error(`[phone-verify] ${errors.length} console/page errors:`)
    for (const e of errors.slice(0, 10)) console.error("  •", e)
    process.exit(1)
  }
  console.log("[phone-verify] OK — no errors")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
