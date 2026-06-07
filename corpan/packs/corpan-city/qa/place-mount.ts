/**
 * Place-vignette QA mount (#14) — renders the enterable CORNER CAFÉ interior in
 * isolation (no 3D world, no host). It stubs the VignetteContext services so the
 * warm interior + the resident barista tray + the "Order" action all paint, and
 * the ?kind=shop variant shows the generic shop skin. Drive it with `?kind=cafe`
 * (default) or `?kind=shop`.
 *
 * This proves the interior is pure DOM — NO Babylon mesh is created — which is
 * exactly why walking into a building is perf-zero (an overlay scene, never a new
 * always-rendered 3D room that could regress the 60 FPS the world holds).
 */
import { createPlaceVignette } from "../src/vignettes/place"
import type { VignetteContext } from "../src/vignettes/types"

const root = document.getElementById("app") ?? document.body
root.className = "wp-overlay"
root.style.cssText = "position:fixed;inset:0;background:#1a120b;"

const kind = new URLSearchParams(location.search).get("kind") === "shop" ? "shop" : "cafe"

// A trivial stubbed context — every service is a no-op recorder so the scene paints.
const ctx: VignetteContext = {
  mountRoot: root,
  learnerPair: { target: "es", native: "en" },
  scene: { palette: { accent: "#e8b54a" } } as unknown as VignetteContext["scene"],
  anchorId: kind === "shop" ? "general_store" : "cafe",
  reducedMotion: false,
  speak: async () => {},
  // a tiny faux dialogue tray so the conversation slot reads as occupied.
  openNpc: (args) => {
    const tray = document.createElement("div")
    tray.style.cssText =
      "background:rgba(20,14,9,0.9);color:#f3ece0;padding:12px 16px;font:600 14px/1.4 system-ui;border-radius:14px 14px 0 0;"
    tray.textContent = `${args.npcName}: ${args.scriptedFallback[0] ?? "Welcome in!"}`
    args.container.appendChild(tray)
    return { send() {}, close() {}, dispose() {} }
  },
  wallet: () => ({ defaultCurrency: () => "coin", balance: () => 9999, debit: () => true }),
  grant: () => [],
  runChallenge: async () => ({ score: 1, rewards: { xp: 0 } }) as Awaited<ReturnType<VignetteContext["runChallenge"]>>,
  t: (key) => key, // → inline English fallbacks
  iconRenderer: { renderIcon: () => document.createElement("span") } as unknown as VignetteContext["iconRenderer"],
}

const v =
  kind === "shop"
    ? createPlaceVignette({
        kind: "shop",
        copyKey: "general_store",
        fallback: { sign: "General Store", title: "General Store", sub: "Goods, curios & sundries", keeper: "the keeper", greet: ["Welcome in!"] },
        persona: { tone: "a warm shopkeeper", quirks: [] },
        onShop: () => console.log("[qa] would open the economy shop overlay"),
        shopLabel: ["k", "Browse the shelves"],
      })
    : createPlaceVignette({
        kind: "cafe",
        copyKey: "cafe",
        fallback: {
          sign: "Café",
          title: "Corner Café",
          sub: "Coffee, pastries & a warm welcome",
          keeper: "the barista",
          greet: ["Welcome in! What can I get you?"],
        },
        persona: { tone: "a warm barista", quirks: [] },
        objective: { label: ["k", "Order a coffee"], tool: "translate-fast", questStep: "order", reward: { xp: 12 } },
      })

void v.enter(ctx)
