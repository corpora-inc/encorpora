import { webkit } from "playwright"

const URL = process.env.WP_URL || "http://localhost:5191/"
const browser = await webkit.launch()

async function shoot(name, w, h, action) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  const logs = []
  page.on("console", (m) => logs.push(m.text()))
  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__wpVerifyReady === true, { timeout: 8000 }).catch(() => {})
  if (action) await action(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `/tmp/wp-map-${name}.png` })
  console.log(`--- ${name} (${w}x${h}) ---`)
  for (const l of logs.filter((l) => l.startsWith("[verify]"))) console.log("   " + l)
  await page.close()
}

// Desktop: minimap + full map open (the harness auto-opens the modal).
await shoot("desktop-full", 1280, 800, async () => {})

// Desktop: just the minimap (close the auto-opened modal first).
await shoot("desktop-minimap", 1280, 800, async (page) => {
  await page.click(".wp-map-close").catch(() => {})
  await page.waitForTimeout(300)
})

// Tablet portrait.
await shoot("tablet-full", 834, 1112, async () => {})

// Phone: minimap only.
await shoot("phone-minimap", 390, 844, async (page) => {
  await page.click(".wp-map-close").catch(() => {})
  await page.waitForTimeout(300)
})

// Menu-section render (the MenuSectionView factory).
await shoot("menu-section", 1280, 800, async (page) => {
  await page.click(".wp-map-close").catch(() => {})
  await page.waitForTimeout(200)
  await page.click("text=Open as menu section").catch(() => {})
  await page.waitForTimeout(400)
})

await browser.close()
console.log("done")
