import { webkit } from "playwright"

const URL = process.env.WP_URL || "http://localhost:5174/src/shell/phone/__verify__/index.html"
const browser = await webkit.launch()

async function page(w, h, query = "") {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  p.on("console", (m) => {
    if (m.text().startsWith("[verify]")) console.log("   " + m.text())
  })
  await p.goto(URL + query, { waitUntil: "networkidle" })
  await p.waitForFunction(() => window.__wpVerifyReady === true, { timeout: 8000 }).catch(() => {})
  return p
}

async function drive(p, fn) {
  await p.evaluate(fn)
  await p.waitForTimeout(450)
}

async function shoot(p, name) {
  await p.screenshot({ path: `/tmp/wp-phone-${name}.png` })
  console.log(`shot: wp-phone-${name}.png`)
}

// --- Phone (390x844) ---
{
  const p = await page(390, 844)
  await shoot(p, "fab") // the single Corpán-logo FAB, world view
  await drive(p, () => window.__wpPhone.open())
  await shoot(p, "home") // the app grid + Leave row
  await drive(p, () => window.__wpPhone.open("things"))
  await shoot(p, "app-things") // an opened app + back chevron
  await drive(p, () => window.__wpPhone.open("music"))
  await shoot(p, "music-off") // Music app, switch OFF (no auto-blast)
  await drive(p, () => document.querySelector(".wp-phone-switch")?.click())
  await shoot(p, "music-on") // switch ON → transport + dial
  await p.close()
}

// --- Phone RTL ---
{
  const p = await page(390, 844, "?dir=rtl")
  await drive(p, () => window.__wpPhone.open())
  await shoot(p, "home-rtl")
  await p.close()
}

// --- Tablet (834x1112) ---
{
  const p = await page(834, 1112)
  await drive(p, () => window.__wpPhone.open())
  await shoot(p, "tablet-home")
  await p.close()
}

// --- Desktop (1280x800) ---
{
  const p = await page(1280, 800)
  await drive(p, () => window.__wpPhone.open("music"))
  await drive(p, () => document.querySelector(".wp-phone-switch")?.click())
  await shoot(p, "desktop-music")
  await p.close()
}

await browser.close()
console.log("done")
