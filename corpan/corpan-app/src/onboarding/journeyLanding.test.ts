// Regression test for the guided-Journey onboarding path landing on Home
// instead of the Journey feed (reported live, ES UI / EN target). Walks the
// REAL `ONBOARDING_GRAPH` + REAL `commitDraft` (via the "commit" node) and
// its real store dependencies (settings/landing/journey stores), exercising
// the exact apply/next sequence `useOnboardingGraph` would run for a user
// who picks "learn" → any calibration → "guided" at journeyOptIn, including
// several Back-navigation permutations through the pickPhrasePacks/tts
// screens the reviewer's `journeyOptIn: false` explore-reset fix touches.
//
// `graph.ts` reads real zustand stores (settings/landing/journey) via
// `.getState()`, so — like journeyPack.test.ts / wordPack.test.ts — we
// bundle through esbuild (a dev dep) with the app tsconfig's path mapping
// and a couple of browser polyfills (localStorage/window) the persisted
// stores need at import time, then exercise the real exports. Run with:
// `npm test` (node --experimental-strip-types --test).

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

type Draft = Record<string, unknown>
type NodeCtx = {
  draft: Draft
  patch: (p: Draft) => void
  t: (k: string) => string
  primary: () => string
  targets: () => string[]
}
type QuestionOption = { id: string; apply?: (c: NodeCtx) => void; next: unknown }
type Node = {
  kind: string
  next?: unknown
  options?: QuestionOption[]
  apply?: (c: NodeCtx, ids: string[]) => void
  commit?: (c: NodeCtx) => void
}
type Graph = Record<string, Node>
type LandingIntent = { kind: string; packId?: string } | null

let ONBOARDING_GRAPH: Graph
let ENTRY_NODE: string
let resolveNext: (spec: unknown, ctx: NodeCtx) => string
let useSettingsStore: { getState: () => any }
let useLandingStore: { getState: () => any; setState: (s: any) => void }

before(async () => {
  class MemoryStorage {
    private m = new Map<string, string>()
    getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
    setItem(k: string, v: string) { this.m.set(k, String(v)) }
    removeItem(k: string) { this.m.delete(k) }
    clear() { this.m.clear() }
    key(i: number) { return [...this.m.keys()][i] ?? null }
    get length() { return this.m.size }
  }
  ;(globalThis as any).localStorage = new MemoryStorage()
  ;(globalThis as any).window = globalThis
  try { (globalThis as any).navigator.onLine = true } catch { /* getter-only in this Node */ }
  ;(globalThis as any).window.addEventListener = () => {}
  ;(globalThis as any).window.removeEventListener = () => {}
  ;(globalThis as any).document = (globalThis as any).document || {
    addEventListener() {}, removeEventListener() {}, visibilityState: "visible",
  }

  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    // Virtual entry point (no stray file in src/): re-exports graph.ts plus
    // the store getters this test needs to inspect, so everything resolves
    // through ONE shared module graph (same store singletons graph.ts uses).
    stdin: {
      contents: `
        export * from "./graph"
        export { useSettingsStore } from "../store/settings"
        export { useLandingStore } from "../store/landing"
        export { resolveNext } from "./types"
      `,
      resolveDir: here,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
    tsconfig: path.join(here, "../../tsconfig.json"),
    define: {
      "import.meta.env": JSON.stringify({ DEV: false }),
      __APP_VERSION__: JSON.stringify("0.0.0-test"),
    },
  })
  const code = res.outputFiles[0].text
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )
  ONBOARDING_GRAPH = mod.ONBOARDING_GRAPH
  ENTRY_NODE = mod.ENTRY_NODE
  resolveNext = mod.resolveNext
  useSettingsStore = mod.useSettingsStore
  useLandingStore = mod.useLandingStore
})

/** Faithful (non-React) re-implementation of `useOnboardingGraph`'s
 *  traversal — same goTo/choose/chooseMulti/advance/back semantics,
 *  exercised against the real graph + real node callbacks. */
function makeSession() {
  let currentId = ENTRY_NODE
  const history: string[] = []
  let draft: Draft = {}
  const ctx = (): NodeCtx => ({
    draft,
    patch: (p) => { draft = { ...draft, ...p } },
    t: (k) => k,
    primary: () => useSettingsStore.getState().languages[0] ?? "",
    targets: () => useSettingsStore.getState().languages.slice(1),
  })
  const goTo = (id: string) => { history.push(currentId); currentId = id }
  return {
    get id() { return currentId },
    get draft() { return draft },
    advance() {
      const node = ONBOARDING_GRAPH[currentId]
      if (!node || node.kind === "terminal" || node.kind === "question") return
      goTo(resolveNext(node.next, ctx()))
    },
    choose(optionId: string) {
      const node = ONBOARDING_GRAPH[currentId]
      const option = node.options!.find((o) => o.id === optionId)!
      const c = ctx()
      option.apply?.(c)
      goTo(resolveNext(option.next, c))
    },
    chooseMulti(ids: string[]) {
      const node = ONBOARDING_GRAPH[currentId]
      const c = ctx()
      node.apply!(c, ids)
      goTo(resolveNext(node.next, c))
    },
    back() {
      if (!history.length) return
      currentId = history.pop()!
    },
    commit() {
      ONBOARDING_GRAPH.commit.commit!(ctx())
    },
  }
}

/** Drive welcome → forkJourney → "learn" → calibrateLearn (any answer) →
 *  journeyOptIn, then hand off to `fn` for the journeyOptIn choice onward. */
function runGuidedScenario(
  calibrateLearnAnswer: string,
  fn: (s: ReturnType<typeof makeSession>) => void,
): LandingIntent {
  useSettingsStore.getState().setLanguages(["es", "en"])
  useLandingStore.setState({ landing: null })
  const s = makeSession()
  s.advance(); s.advance(); s.advance() // welcome -> pickPrimary -> welcomePact -> forkJourney
  s.choose("learn") // -> pickLearning
  s.advance() // pickLearning -> calibrateLearn (journey !== polyglot)
  s.choose(calibrateLearnAnswer) // -> journeyOptIn
  fn(s)
  assert.equal(s.id, "commit", `expected to reach commit, stuck at ${s.id}`)
  s.commit()
  return useLandingStore.getState().landing
}

test("guided ES→EN, straight through, lands in the Journey feed", () => {
  const landing = runGuidedScenario("a_little", (s) => {
    s.choose("guided")
    s.advance(); s.advance() // pickPhrasePacks -> tts -> interests
    s.chooseMulti([])
  })
  assert.deepEqual(landing, { kind: "journey" })
})

test("guided ES→EN, total-beginner (zero-beginner placement), lands in Journey", () => {
  const landing = runGuidedScenario("never", (s) => {
    assert.equal((s.draft as any).journeyOptIn, undefined) // not yet applied
    s.choose("guided")
    assert.equal((s.draft as any).journeyPlacement, "zero-beginner")
    s.advance(); s.advance()
    s.chooseMulti([])
  })
  assert.deepEqual(landing, { kind: "journey" })
})

test("guided → Back at pickPhrasePacks → guided again → Journey (no bounce to Home)", () => {
  const landing = runGuidedScenario("a_little", (s) => {
    s.choose("guided") // -> pickPhrasePacks
    s.back() // -> journeyOptIn
    s.choose("guided") // -> pickPhrasePacks
    s.advance(); s.advance()
    s.chooseMulti([])
  })
  assert.deepEqual(landing, { kind: "journey" })
})

test("guided → tts → Back → Back → guided again → Journey", () => {
  const landing = runGuidedScenario("a_little", (s) => {
    s.choose("guided") // pickPhrasePacks
    s.advance() // tts
    s.back() // pickPhrasePacks
    s.back() // journeyOptIn
    s.choose("guided")
    s.advance(); s.advance()
    s.chooseMulti([])
  })
  assert.deepEqual(landing, { kind: "journey" })
})

test("explore → Back → guided → Journey (the reviewer's journeyOptIn:false reset doesn't stick)", () => {
  const landing = runGuidedScenario("a_little", (s) => {
    s.choose("explore") // pickPhrasePacks, journeyOptIn=false
    s.back() // journeyOptIn
    s.choose("guided") // pickPhrasePacks, journeyOptIn should be true again
    s.advance(); s.advance()
    s.chooseMulti([])
  })
  assert.deepEqual(landing, { kind: "journey" })
})

test("guided → interests → Back all the way to journeyOptIn → guided again → Journey", () => {
  const landing = runGuidedScenario("a_little", (s) => {
    s.choose("guided")
    s.advance(); s.advance() // tts, interests
    s.back() // tts
    s.back() // pickPhrasePacks
    s.back() // journeyOptIn
    s.choose("guided")
    s.advance(); s.advance()
    s.chooseMulti([])
  })
  assert.deepEqual(landing, { kind: "journey" })
})

test("guided → Back → explore (unchanged): explorer does NOT land in Journey", () => {
  useSettingsStore.getState().setLanguages(["es", "en"])
  useLandingStore.setState({ landing: null })
  const s = makeSession()
  s.advance(); s.advance(); s.advance()
  s.choose("learn")
  s.advance()
  s.choose("a_little") // -> journeyOptIn
  s.choose("guided") // pickPhrasePacks, journeyOptIn=true
  s.back() // journeyOptIn
  s.choose("explore") // journeyOptIn explicitly reset to false — the
  // reviewer's fix (graph.ts journeyOptIn.explore.apply) exists precisely so
  // this stale-true doesn't leak into the explorer's landing.
  s.advance(); s.advance() // pickPhrasePacks -> tts -> interests
  s.chooseMulti([]) // journeyOptIn false -> whatToStart, NOT commit
  assert.equal(s.id, "whatToStart")
  assert.equal((s.draft as any).journeyOptIn, false)
})
