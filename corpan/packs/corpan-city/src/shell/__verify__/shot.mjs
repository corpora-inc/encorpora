import { webkit } from "playwright"

const URL = process.env.WP_URL || "http://localhost:5174/src/shell/__verify__/index.html"
const browser = await webkit.launch()

async function page(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  p.on("console", (m) => {
    if (m.text().startsWith("[verify]")) console.log("   " + m.text())
  })
  await p.goto(URL, { waitUntil: "networkidle" })
  await p.waitForFunction(() => window.__wpVerifyReady === true, { timeout: 8000 }).catch(() => {})
  return p
}

async function drive(p, fn) {
  await p.evaluate(fn)
  await p.waitForTimeout(450)
}

async function shoot(p, name) {
  await p.screenshot({ path: `/tmp/wp-fab-${name}.png` })
  console.log(`shot: wp-fab-${name}.png`)
}

// --- Phone (390x844) ---
{
  const p = await page(390, 844)
  await drive(p, () => window.__wpChrome.set("world"))
  await shoot(p, "phone-world")
  await drive(p, () => window.__wpChrome.set("dialogue"))
  await shoot(p, "phone-dialogue") // minimap MUST recede with the band
  await drive(p, () => window.__wpChrome.openMenu("badges"))
  await shoot(p, "phone-menu-badges")
  await p.close()
}

// --- Tablet (834x1112) ---
{
  const p = await page(834, 1112)
  await drive(p, () => window.__wpChrome.set("focused"))
  await shoot(p, "tablet-focused") // band+minimap DIM, pack reachable
  await drive(p, () => window.__wpChrome.openMenu("badges"))
  await shoot(p, "tablet-menu-badges")
  await drive(p, () => window.__wpChrome.openMenu("inventory"))
  await shoot(p, "tablet-menu-empty") // premium empty-state card
  await p.close()
}

// --- Desktop (1280x800) ---
{
  const p = await page(1280, 800)
  await drive(p, () => window.__wpChrome.set("world"))
  await shoot(p, "desktop-world")
  await drive(p, () => window.__wpChrome.openMenu("badges"))
  await shoot(p, "desktop-menu-badges")
  await drive(p, () => {
    window.__wpChrome.closeMenu()
  })
  await p.evaluate(() => document.querySelector(".wp-minimap")?.click())
  await p.waitForTimeout(500)
  await shoot(p, "desktop-map")
  await p.close()
}

await browser.close()
console.log("done")
