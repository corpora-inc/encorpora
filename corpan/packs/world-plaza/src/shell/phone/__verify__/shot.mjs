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

async function drive(p, fn, arg) {
  await p.evaluate(fn, arg)
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
  await drive(p, () => window.__wpPhone.open())
  await shoot(p, "desktop-home")
  await drive(p, () => window.__wpPhone.open("music"))
  await drive(p, () => document.querySelector(".wp-phone-switch")?.click())
  await shoot(p, "desktop-music")
  await p.close()
}

/* ===================== CONSTANT-SIZE INVARIANT (the #1 fix) =====================
 * PHONE_DESIGN.md §1: the device frame must be byte-identical across the home
 * screen and EVERY app — switching apps must NEVER resize the slab. We measure
 * `.wp-phone-device` on home, then on each app, and FAIL the run on any >0.5px
 * drift. This assertion is the contract; keep it green. */
let invariantFailed = false
async function assertConstantSize(w, h, label) {
  const p = await page(w, h)
  const rect = () =>
    p.evaluate(() => {
      const el = document.querySelector(".wp-phone-device")
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
  await drive(p, () => window.__wpPhone.open())
  const home = await rect()
  if (!home) {
    console.log(`   [const-size ${label}] FAIL: no .wp-phone-device found`)
    invariantFailed = true
    await p.close()
    return
  }
  const apps = ["map", "things", "quest", "badges", "music"]
  let ok = true
  for (const id of apps) {
    await drive(p, (a) => window.__wpPhone.open(a), id)
    const r = await rect()
    const same = ["x", "y", "width", "height"].every((k) => Math.abs(r[k] - home[k]) < 0.5)
    if (!same) {
      ok = false
      invariantFailed = true
      console.log(`   [const-size ${label}] FAIL ${id}: ${JSON.stringify(r)} vs home ${JSON.stringify(home)}`)
    }
  }
  console.log(
    `   [const-size ${label}] device ${Math.round(home.width)}x${Math.round(home.height)} @ x=${Math.round(home.x)} — ${ok ? "PASS" : "FAIL"}`,
  )
  await p.close()
}
await assertConstantSize(1280, 800, "desktop")
await assertConstantSize(834, 1112, "tablet")
await assertConstantSize(390, 844, "phone")

await browser.close()
if (invariantFailed) {
  console.error("CONSTANT-SIZE INVARIANT FAILED — the device frame resized between apps")
  process.exit(1)
}
console.log("done")
