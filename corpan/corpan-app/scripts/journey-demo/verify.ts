// scripts/journey-demo/verify.ts — headless proof that the browser demo's
// JSON-backed ports work: drives the REAL runtime (createJourneyRuntime) +
// REAL engine + REAL resolver over the PRECOMPUTED course.json (NOT the
// sqlite pack) and completes >= 10 cards, exactly what the demo page wires.
//
// Pattern: esbuild-bundle wiring.ts + runtime.ts (their module graphs carry
// jsx-free but extensionful TS — the smoke.test.ts precedent), import the
// bundle as a data URL, drive the runtime API directly (the FeedScroller's
// own calls per card kind).
//
// Run:  node --experimental-strip-types scripts/journey-demo/verify.ts

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(here, "../..")
const COURSE_JSON = path.resolve(APP, "public/journey-demo/course.json")

// ------------------------------------------------------- browser-ish shims
// runtime.ts's closure touches localStorage (store/journey persist, streakV2)
// and window event dispatch. Minimal shims — no DOM needed at this level.

const store = new Map<string, string>()
const localStorageShim = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
}
const g = globalThis as Record<string, unknown>
g.localStorage = localStorageShim
if (!g.window) {
  g.window = {
    localStorage: localStorageShim,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    setTimeout,
    clearTimeout,
  }
}
if (!g.CustomEvent) {
  g.CustomEvent = class CustomEvent {
    type: string
    detail: unknown
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type
      this.detail = init?.detail
    }
  }
}

// ----------------------------------------------------------------- helpers

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitFor<T>(fn: () => T | null | undefined, what: string, ms = 10_000): Promise<T> {
  const t0 = Date.now()
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`)
    await sleep(15)
  }
}

function fail(msg: string): never {
  console.error(`[journey-demo verify] FAIL: ${msg}`)
  process.exit(1)
}

// ------------------------------------------------------------------- main

type CardLike = {
  kind: string
  cardId: string
  spec?: { specId: string; activityType: string }
  prepared?: { items: Array<{ ref: unknown; target: { text: string } }> } | null
}

async function main(): Promise<void> {
  if (!fs.existsSync(COURSE_JSON)) {
    fail(`${COURSE_JSON} missing — run precompute.ts first`)
  }
  const data = JSON.parse(fs.readFileSync(COURSE_JSON, "utf-8"))

  const { build } = await import("esbuild")
  const res = await build({
    stdin: {
      contents:
        `export { buildDemoDeps } from ${JSON.stringify(path.resolve(APP, "src/journey/demo/wiring.ts"))}\n` +
        `export { createJourneyRuntime } from ${JSON.stringify(path.resolve(APP, "src/journey/runtime.ts"))}\n` +
        `export { matchImagePackOffer } from ${JSON.stringify(path.resolve(APP, "src/journey/imagePackProvision.ts"))}\n` +
        `export { useDataPacksStore } from ${JSON.stringify(path.resolve(APP, "src/store/dataPacks.ts"))}\n`,
      resolveDir: APP,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
    define: {
      "import.meta.env.DEV": "false",
      "process.env.NODE_ENV": '"production"',
    },
    tsconfig: path.resolve(APP, "tsconfig.json"),
    alias: {
      "@shared": path.resolve(APP, "../packs/shared"),
      "@": path.resolve(APP, "src"),
    },
    loader: { ".css": "empty" },
    external: ["node:*"],
  })
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(res.outputFiles[0].text).toString("base64")
  )

  const missing: Array<Record<string, unknown>> = []
  const events: string[] = []
  const deps = mod.buildDemoDeps(data, {
    record: () => {},
    log: (event: string, d: Record<string, unknown>) => {
      events.push(event)
      if (event === "journey_content_missing") missing.push(d)
      if (event === "journey_content_db_error") fail(`db_error from JSON port: ${JSON.stringify(d)}`)
    },
  })
  const runtime = mod.createJourneyRuntime(deps)

  const { needsPlacement } = await runtime.start("landing")
  console.log(`[journey-demo verify] started (needsPlacement=${needsPlacement})`)
  if (needsPlacement) {
    // The placement flow's "I'm new" (zero-beginner) path, verbatim — the
    // cold-start branch the demo page reaches through PlacementFlow.
    const controller = runtime.startPlacement("zero-beginner")
    runtime.finishPlacement(controller.finalize())
    console.log("[journey-demo verify] placement: zero-beginner finalized")
  }

  const seen: Record<string, number> = {}
  let guard = 0
  while (runtime.sessionStats().cardsCompleted < 10 && guard < 60) {
    guard += 1
    const card = (await waitFor(() => runtime.current(), "next card")) as CardLike
    seen[card.spec?.activityType ?? card.kind] = (seen[card.spec?.activityType ?? card.kind] ?? 0) + 1

    switch (card.kind) {
      case "exercise": {
        const items = card.prepared?.items ?? []
        runtime.submitResult(card.cardId, {
          specId: card.spec!.specId,
          score: 1,
          perItem: items.map((it) => ({ itemRef: it.ref, outcome: "pass", latencyMs: 800 })),
          durationMs: 1500,
        })
        await waitFor(() => runtime.currentSettled(), `settle ${card.spec?.activityType}`)
        runtime.advance()
        break
      }
      case "checkpoint": {
        runtime.checkpointChoice(card.cardId, "continue")
        await waitFor(
          () => (runtime.current()?.cardId !== card.cardId ? true : null),
          "checkpoint advance",
        )
        break
      }
      case "blockIntro":
      case "welcomeBack":
        runtime.completePresentation(card.cardId)
        break
      case "jumpOffer": {
        // FeedScroller's decline path, verbatim
        runtime.submitResult(card.cardId, {
          specId: card.cardId,
          score: 0,
          perItem: [],
          durationMs: 0,
        })
        runtime.advance()
        break
      }
      default:
        runtime.abandonCurrent()
    }
    await sleep(10)
  }

  const completed = runtime.sessionStats().cardsCompleted
  console.log(
    `[journey-demo verify] completed=${completed} (guard=${guard}) cards=${JSON.stringify(seen)}`,
  )
  console.log(
    `[journey-demo verify] resolver events=${events.length} content_missing=${missing.length}` +
      (missing.length ? ` ${JSON.stringify(missing.slice(0, 5))}` : ""),
  )
  if (completed < 10) fail(`completed ${completed} < 10 cards`)
  if (runtime.history().length < 10) fail("history ring not filled")

  // -------------------------------------------------- imagepan concept proof
  // Prove the picture-choice content path end-to-end over the SAME demo ports:
  // the resolver returns a `concept` item with a corpan-pack:// imageSrc + a
  // distractor picture. This is what runtime.maybeImageChoice consumes to
  // upgrade a first-exposure word card to a media:'image' ChoicePick. (The
  // device serves the real WebP over the corpan-pack scheme; the demo URL is
  // intentionally the same shape but points at an absent file — the SHAPE is
  // the contract being proven here.)
  const conceptOut = await deps.resolver.resolveItems([
    { kind: "concept", source: "imagepan", id: "coffee" },
  ])
  const cItem = conceptOut.resolved[0]
  if (!cItem || cItem.extras?.kind !== "concept") {
    fail(`concept resolve: expected a concept item, got ${JSON.stringify(conceptOut)}`)
  }
  const cx = cItem.extras as { imageSrc?: string; distractors?: unknown[] }
  if (cx.imageSrc !== "/journey-demo/absent/imagepan/images/coffee.webp") {
    fail(`concept resolve: unexpected imageSrc ${cx.imageSrc}`)
  }
  if (!Array.isArray(cx.distractors) || cx.distractors.length < 1) {
    fail(`concept resolve: expected >= 1 distractor picture, got ${JSON.stringify(cx.distractors)}`)
  }
  console.log(
    `[journey-demo verify] imagepan concept OK — imageSrc + ${cx.distractors.length} distractor picture(s)`,
  )

  // -------------------------------------------- imagepan CONSENT-OFFER proof
  // Prove the one-tap offer gate end-to-end WITHOUT any silent download: the
  // pure availability resolver offers a compatible index entry (with a
  // dynamic sizeMb to show), a Decline is persisted so it never re-offers, and
  // an incompatible/absent index yields no offer (graceful degrade). This is
  // the exact logic the ImagePackOfferBanner drives; only the click is DOM.
  const idxEntry = {
    id: "imagepan",
    kind: "image-pack",
    name: "Picture concepts",
    version: "0.1.0",
    zipUrl: "https://cdn.example/imagepan-0.1.0.zip",
    sizeMb: 1.4,
    conceptCount: 95,
    channel: "stable",
  }
  const goodCatalog = { version: 1, generatedAt: "x", packs: [idxEntry] }
  const offer = mod.matchImagePackOffer(goodCatalog, "1.0.0", false)
  if (!offer || offer.id !== "imagepan") {
    fail(`image offer: expected a compatible entry, got ${JSON.stringify(offer)}`)
  }
  if (!(offer.sizeMb > 0)) {
    fail(`image offer: size must be shown dynamically from the entry, got sizeMb=${offer.sizeMb}`)
  }
  // Never auto-download → the pack starts UNregistered (ships inert).
  const dp = mod.useDataPacksStore.getState()
  if (dp.has("imagepan")) fail("image offer: imagepan must NOT be pre-registered (no silent install)")
  // Decline is remembered so we don't nag next session.
  dp.decline("imagepan")
  if (!mod.useDataPacksStore.getState().isDeclined("imagepan")) {
    fail("image offer: a decline must be persisted")
  }
  // Accept path: registering flips the resolver's sync recognition gate.
  mod.useDataPacksStore.getState().register({
    id: "imagepan",
    version: offer.version,
    installedAt: new Date().toISOString(),
    source: "catalog",
  })
  if (!mod.useDataPacksStore.getState().has("imagepan")) {
    fail("image offer: an accepted install must flip findInstalledPack('imagepan')")
  }
  // Graceful degrade: no catalog / preview-only-in-prod ⇒ no offer.
  if (mod.matchImagePackOffer(null, "1.0.0", false) !== null) {
    fail("image offer: an unreachable index must yield no offer")
  }
  const previewOnly = {
    version: 1,
    generatedAt: "x",
    packs: [{ ...idxEntry, channel: "preview" }],
  }
  if (mod.matchImagePackOffer(previewOnly, "1.0.0", false) !== null) {
    fail("image offer: a preview-only entry must be hidden from a non-dev build")
  }
  // reset so nothing leaks into a re-run of the same process
  mod.useDataPacksStore.setState({ installed: {}, declined: {} })
  console.log(
    `[journey-demo verify] imagepan offer OK — one-tap consent (size ≈${idxEntry.sizeMb} MB), decline persisted, degrade clean`,
  )

  console.log("[journey-demo verify] PASS — >= 10 cards over the precomputed JSON ports")
  process.exit(0)
}

await main()
