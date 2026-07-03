// JourneySurface headless smoke test (the W4 exit gate): a full session over
// the CHECKED-IN W6 fixture course pack
// (dja/journey_pack/fixtures/dist/journey_en/data/course.sqlite3), through
// the REAL engine, REAL resolver, and the REAL React surface — driven like a
// user in jsdom (clicks, typing), completing ≥ 10 cards end-to-end.
//
// Pattern: esbuild-bundle src/journey/__smoke__/entry.tsx (jsx + tauri-ish
// imports can't run under strip-types), import the bundle as a data URL
// inside a jsdom-globals environment, and drive the DOM from here
// (journeyPack.test.ts precedent).

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import { DatabaseSync } from "node:sqlite"

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DB = path.resolve(
  here,
  "../../../dja/journey_pack/fixtures/dist/journey_en/data/course.sqlite3",
)

type Row = Record<string, unknown>
type SmokeHandle = {
  runtime: {
    current(): CardLike | null
    currentSettled(): { result: { score: number; abandoned?: boolean } | null } | null
    advance(): void
    sessionStats(): { cardsCompleted: number }
    history(): unknown[]
    abandonCurrent(): void
    checkpointChoice(id: string, c: "stop" | "continue"): void
    completePresentation(id: string): void
  }
}
type CardLike = {
  kind: string
  cardId: string
  spec?: { activityType: string; targetLang: string; params?: Record<string, unknown> }
  prepared?: {
    items: Array<{
      key: string
      ref: { id: string }
      target: { text: string }
      native?: { text: string }
    }>
    direction?: string
    blankIndex?: number
    sttFallback?: boolean
  }
}

let dom: import("jsdom").JSDOM
let handle: SmokeHandle | null = null

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitFor<T>(
  fn: () => T | null | undefined,
  what: string | (() => string),
  ms = 4000,
): Promise<T> {
  const t0 = Date.now()
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() - t0 > ms)
      throw new Error(`timeout waiting for ${typeof what === "function" ? what() : what}`)
    await sleep(15)
  }
}

function click(el: Element): void {
  // Only the click event: a synthetic pointerdown would arm the FeedScroller
  // drag gesture (framer-motion) and swallow the click in jsdom.
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }))
}

function byTestId(id: string, scope?: Element | null): Element | null {
  return (scope ?? dom.window.document).querySelector(`[data-testid="${id}"]`)
}

/** The mounted wrapper of the CURRENT card (AnimatePresence keeps the
 *  previous card in the DOM while it exits — never query document-wide). */
function currentScope(cardId: string): Element | null {
  return dom.window.document.querySelector(`[data-journey-current="${cardId}"]`)
}

function buttonWithText(text: string, scope?: Element | null): HTMLElement | null {
  const root = scope ?? dom.window.document
  const norm = (s: string) => s.replace(/\s+/g, " ").trim()
  for (const b of root.querySelectorAll("button")) {
    if (norm(b.textContent ?? "") === norm(text)) return b as HTMLElement
  }
  return null
}

function typeInto(input: HTMLInputElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    "value",
  )!.set!
  setter.call(input, text)
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
}

before(async () => {
  assert.ok(fs.existsSync(FIXTURE_DB), `W6 fixture pack missing at ${FIXTURE_DB}`)

  const { JSDOM } = await import("jsdom")
  dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    pretendToBeVisual: true,
    url: "http://localhost/",
  })
  const g = globalThis as Record<string, unknown>
  g.window = dom.window
  g.document = dom.window.document
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  })
  g.localStorage = dom.window.localStorage
  g.HTMLElement = dom.window.HTMLElement
  g.HTMLInputElement = dom.window.HTMLInputElement
  g.Element = dom.window.Element
  g.Node = dom.window.Node
  g.CustomEvent = dom.window.CustomEvent
  g.MouseEvent = dom.window.MouseEvent
  g.PointerEvent = dom.window.MouseEvent // jsdom has no PointerEvent
  g.Event = dom.window.Event
  g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
  g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
  if (!dom.window.matchMedia) {
    const mm = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
    ;(dom.window as unknown as Record<string, unknown>).matchMedia = mm
    g.matchMedia = mm
  } else {
    g.matchMedia = dom.window.matchMedia.bind(dom.window)
  }
  // ResizeObserver for framer-motion layout features
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  g.ResizeObserver = RO
  ;(dom.window as unknown as Record<string, unknown>).ResizeObserver = RO

  const { build } = await import("esbuild")
  const res = await build({
    entryPoints: [path.join(here, "__smoke__/entry.tsx")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
    define: {
      "import.meta.env.DEV": "false",
      "process.env.NODE_ENV": '"production"',
      // Vite build-time constant reached via PackActivityCard → store/catalog
      // → lib/appVersion (poster enrichment, W10 item 17).
      __APP_VERSION__: '"0.0.0-smoke"',
    },
    tsconfig: path.join(here, "../../tsconfig.json"),
    alias: {
      "@shared": path.resolve(here, "../../../packs/shared"),
      "@": path.resolve(here, ".."),
    },
    loader: { ".css": "empty" },
    external: ["node:*"],
  })
  const code = res.outputFiles[0].text
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )

  const db = new DatabaseSync(FIXTURE_DB, { readOnly: true })
  const query = async (sql: string, params: unknown[], maxRows: number): Promise<Row[]> => {
    const rows = db.prepare(sql).all(...(params as (string | number | null)[])) as Row[]
    return rows.slice(0, Math.min(maxRows, 2000))
  }

  await mod.mountSmoke({
    container: dom.window.document.getElementById("root"),
    query,
    onRuntime: (h: SmokeHandle) => {
      handle = h
    },
  })
})

/** Answer the current card through the DOM, then advance via the runtime. */
async function driveOneCard(h: SmokeHandle): Promise<void> {
  const card = await waitFor(() => h.runtime.current(), "next card", 6000)
  const t = card.spec?.activityType ?? card.kind
  const scope = () => currentScope(card.cardId)

  if (card.kind === "checkpoint") {
    const btn = await waitFor(() => byTestId("journey-checkpoint-continue", scope()), "checkpoint continue")
    click(btn)
    return
  }
  if (card.kind === "blockIntro") {
    const btn = await waitFor(() => byTestId("journey-block-ready", scope()), "block ready")
    click(btn)
    return
  }
  if (card.kind === "welcomeBack") {
    h.runtime.completePresentation(card.cardId)
    return
  }
  if (card.kind === "jumpOffer") {
    const btn = await waitFor(() => byTestId("journey-jump-decline", scope()), "jump decline")
    click(btn)
    await waitFor(() => (h.runtime.current()?.cardId !== card.cardId ? true : null), "jump advance")
    return
  }
  if (card.kind !== "exercise") {
    h.runtime.abandonCurrent()
    return
  }

  // rare-card back? reveal first
  const back = byTestId("journey-rare-back", scope())
  if (back) {
    click(back)
    await sleep(750)
  }

  const items = card.prepared?.items ?? []
  const answer = items[0]

  const settleThenAdvance = async () => {
    await waitFor(
      () => h.runtime.currentSettled(),
      () =>
        `settle ${t} (cur=${h.runtime.current()?.cardId} stampC=${!!byTestId("journey-stamp-correct")} stampI=${!!byTestId("journey-stamp-incorrect")} tiles=${[...dom.window.document.querySelectorAll("[data-journey-tile]")].map((b) => `"${b.textContent}"[${(b.className || "").includes("emerald") ? "C" : (b.className || "").includes("red") ? "W" : "-"}]`).join(",")})`,
      6000,
    )
    h.runtime.advance()
  }

  switch (t) {
    case "choice_pick": {
      const toNative = card.spec?.params?.direction === "toNative"
      const text = toNative ? (answer.native?.text ?? answer.target.text) : answer.target.text
      const btn = await waitFor(() => buttonWithText(text, scope()), `choice tile "${text}"`)
      click(btn)
      break
    }
    case "listen_pick": {
      const btn = await waitFor(() => buttonWithText(answer.target.text, scope()), "listen tile")
      click(btn)
      break
    }
    case "listen_type": {
      const input = (await waitFor(
        () => byTestId("journey-type-input", scope()),
        "type input",
      )) as HTMLInputElement
      typeInto(input, answer.target.text)
      click(await waitFor(() => byTestId("journey-type-submit", scope()), "type submit"))
      break
    }
    case "cloze": {
      const words = answer.target.text.split(/\s+/)
      const blank = words[Math.min(card.prepared?.blankIndex ?? 0, words.length - 1)]
      if (card.spec?.params?.mode === "type") {
        const input = (await waitFor(
          () => byTestId("journey-type-input", scope()),
          "cloze input",
        )) as HTMLInputElement
        typeInto(input, blank)
        click(await waitFor(() => byTestId("journey-type-submit", scope()), "cloze submit"))
      } else {
        const tiles = await waitFor(() => byTestId("journey-answer-tiles", scope()), "cloze bank")
        const btn = await waitFor(() => buttonWithText(blank, tiles), `cloze tile "${blank}"`)
        click(btn)
      }
      break
    }
    case "word_order": {
      const words = answer.target.text.split(/\s+/)
      const zone = await waitFor(() => byTestId("journey-order-tiles", scope()), "order tiles")
      for (const w of words) {
        const btn = await waitFor(() => {
          for (const b of zone.querySelectorAll("button:not(:disabled)")) {
            if ((b.textContent ?? "").trim() === w) return b as HTMLElement
          }
          return null
        }, `order tile "${w}"`)
        click(btn)
      }
      break
    }
    case "match_pairs": {
      for (const item of items) {
        const left = await waitFor(
          () => scope()?.querySelector(`[data-journey-pair-left="${item.key}"]`),
          "pair left",
        )
        click(left)
        const right = await waitFor(
          () => scope()?.querySelector(`[data-journey-pair-right="${item.key}"]`),
          "pair right",
        )
        click(right)
      }
      break
    }
    case "flip_recall": {
      click(await waitFor(() => byTestId("journey-flip", scope()), "flip"))
      click(await waitFor(() => byTestId("journey-flip-knew", scope()), "knew it"))
      break
    }
    case "intro_echo": {
      click(await waitFor(() => byTestId("journey-intro-continue", scope()), "intro continue"))
      break
    }
    case "grammar_note": {
      // embedded drill: bank cloze or word_order over the exemplar (items[1+])
      const drillAnswer = items.length > 1 ? items[1] : items[0]
      const zone = byTestId("journey-order-tiles", scope())
      if (zone) {
        for (const w of drillAnswer.target.text.split(/\s+/)) {
          const btn = await waitFor(() => {
            for (const b of zone.querySelectorAll("button:not(:disabled)")) {
              if ((b.textContent ?? "").trim() === w) return b as HTMLElement
            }
            return null
          }, `grammar tile "${w}"`)
          click(btn)
        }
      } else {
        const words = drillAnswer.target.text.split(/\s+/)
        const blank = words[Math.min((card.spec?.params?.blankIndex as number) ?? 0, words.length - 1)]
        const tiles = await waitFor(() => byTestId("journey-answer-tiles", scope()), "grammar bank")
        click(await waitFor(() => buttonWithText(blank, tiles), `grammar tile "${blank}"`))
      }
      break
    }
    default: {
      // unknown face — skip it honestly
      h.runtime.abandonCurrent()
      return
    }
  }
  await settleThenAdvance()
}

test("JourneySurface completes >= 10 cards over the W6 fixture pack", async () => {
  const h = await waitFor(() => handle, "runtime ready", 8000)

  // placement offer → "I'm new" (zero-beginner) → pact card → feed
  const newBtn = await waitFor(() => byTestId("journey-placement-new"), "placement offer", 8000)
  click(newBtn)
  const cont = await waitFor(() => byTestId("journey-placement-continue"), "placement result")
  click(cont)
  const accept = await waitFor(() => byTestId("journey-pact-accept"), "pact card")
  click(accept)

  await waitFor(() => byTestId("journey-feed"), "feed mounted", 8000)

  let guard = 0
  while (h.runtime.sessionStats().cardsCompleted < 10 && guard < 40) {
    guard += 1
    await driveOneCard(h)
    await sleep(10)
  }
  const completed = h.runtime.sessionStats().cardsCompleted
  assert.ok(completed >= 10, `completed ${completed} cards end-to-end (guard=${guard})`)
  assert.ok(h.runtime.history().length >= 10, "history ring filled")
})
