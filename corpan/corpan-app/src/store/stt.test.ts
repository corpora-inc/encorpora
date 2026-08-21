// Unit tests for the `corpan-stt-v1` single-source-of-truth store (WS-B / R5):
// resolveModelFolder precedence, the parlometron hydrate migration, the one
// probe (refreshInstalled), and ensurePrepared's never-bare-prepare guarantee.
//
// `stt.ts` imports the `@shared/capabilities/*` source aliases, which the bare
// node strip-types loader can't resolve — so we bundle through esbuild (the
// same approach `wordPack.test.ts` uses), which honours the tsconfig `paths`
// alias. The store persists via `createJSONStorage(() => localStorage)` and runs
// a parlometron migration at import time, so we shim + SEED localStorage BEFORE
// the module loads.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

const bag = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => bag.get(k) ?? null,
  setItem: (k: string, v: string) => void bag.set(k, String(v)),
  removeItem: (k: string) => void bag.delete(k),
  clear: () => bag.clear(),
  key: () => null,
  length: 0,
}
// Seed a parlometron solo state so the hydrate migration has something to read.
bag.set("corpan-pronunciation-coach:v2", JSON.stringify({ mode: "large_qlora" }))

// Known modelRegistry folders (stable ids).
const BIG = "ggml-large-v3-q5_0.bin" // large_qlora (~1 GB)
const SMALL = "ggml-small.bin" // ~465 MB
const TINY = "ggml-tiny.bin" // ~75 MB (fresh-install default)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let store: any

const mockStt = (installed: string[], loaded: string | null = null) => ({
  isAvailable: async () => true,
  getStatus: async () => ({
    available: true,
    prepared: loaded != null,
    model: loaded,
    recording: false,
    message: null,
  }),
  listInstalled: async ({ models }: { models: string[] }) => ({
    models: models
      .filter((m) => installed.includes(m))
      .map((m) => ({ model: m, valid: true, problems: [], sizeBytes: 1, isLoaded: m === loaded })),
  }),
  prepare: async (o?: { model?: string }) => ({
    ready: !!o?.model && installed.includes(o.model),
    model: o?.model ?? "",
  }),
  startSession: async (o: { sessionId: string }) => ({ started: true, sessionId: o.sessionId }),
  stopSession: async () => ({}),
  cancelSession: async () => {},
})

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "stt.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    define: { "import.meta.env.DEV": "false" },
    tsconfig: path.join(here, "../../tsconfig.json"),
  })
  const code = res.outputFiles[0].text
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )
  store = mod.useSttStore
})

test("hydrate migrates parlometron mode → preferredModelFolder + seeds priming", () => {
  const s = store.getState()
  assert.equal(s.preferredModelFolder, BIG)
  // A parlometron state exists ⇒ an experienced user ⇒ never show the priming card.
  assert.notEqual(s.micIntroShownAt, null)
})

test("resolveModelFolder: preferred-if-installed wins", () => {
  store.setState({
    installedFolders: [TINY, SMALL, BIG],
    activeModelFolder: TINY,
    preferredModelFolder: BIG,
  })
  assert.equal(store.getState().resolveModelFolder(), BIG)
})

test("resolveModelFolder: preferred not installed → loaded", () => {
  store.setState({
    installedFolders: [TINY, SMALL],
    activeModelFolder: SMALL,
    preferredModelFolder: BIG,
  })
  assert.equal(store.getState().resolveModelFolder(), SMALL)
})

test("resolveModelFolder: neither → largest installed (never tiny over small)", () => {
  store.setState({
    installedFolders: [TINY, SMALL],
    activeModelFolder: null,
    preferredModelFolder: null,
  })
  assert.equal(store.getState().resolveModelFolder(), SMALL)
})

test("resolveModelFolder: nothing installed → null", () => {
  store.setState({ installedFolders: [], activeModelFolder: null, preferredModelFolder: null })
  assert.equal(store.getState().resolveModelFolder(), null)
})

test("refreshInstalled: a real model → readiness installed + seeds priming", async () => {
  store.setState({
    installedFolders: [],
    readiness: "unknown",
    activeModelFolder: null,
    micIntroShownAt: null,
  })
  await store.getState().refreshInstalled(mockStt([BIG], BIG))
  const s = store.getState()
  assert.deepEqual(s.installedFolders, [BIG])
  assert.equal(s.readiness, "installed")
  assert.equal(s.activeModelFolder, BIG)
  assert.notEqual(s.micIntroShownAt, null)
})

test("refreshInstalled: only tiny installed does NOT seed the priming stamp", async () => {
  store.setState({
    installedFolders: [],
    readiness: "unknown",
    activeModelFolder: null,
    micIntroShownAt: null,
  })
  await store.getState().refreshInstalled(mockStt([TINY]))
  assert.equal(store.getState().readiness, "installed")
  assert.equal(store.getState().micIntroShownAt, null)
})

test("refreshInstalled: nothing installed → modelMissing", async () => {
  store.setState({ installedFolders: [], readiness: "unknown", micIntroShownAt: null })
  await store.getState().refreshInstalled(mockStt([]))
  assert.equal(store.getState().readiness, "modelMissing")
})

test("refreshInstalled: unsupported host → unsupported", async () => {
  store.setState({ installedFolders: [BIG], readiness: "unknown" })
  await store
    .getState()
    .refreshInstalled({ ...mockStt([]), isAvailable: async () => false })
  assert.equal(store.getState().readiness, "unsupported")
  assert.deepEqual(store.getState().installedFolders, [])
})

test("ensurePrepared prepares the resolved folder WITH a model (never a bare prepare)", async () => {
  const prepared: Array<string | undefined> = []
  const stt = {
    ...mockStt([BIG], null),
    prepare: async (o?: { model?: string }) => {
      prepared.push(o?.model)
      return { ready: o?.model === BIG, model: o?.model ?? "" }
    },
  }
  store.setState({
    installedFolders: [BIG],
    readiness: "installed",
    activeModelFolder: null,
    preferredModelFolder: BIG,
    engineState: "idle",
  })
  await store.getState().ensurePrepared(stt)
  assert.deepEqual(prepared, [BIG])
  // The recurrence bug was a bare prepare() (model === undefined) unloading the
  // resident model; every prepare here must carry a concrete folder.
  assert.ok(prepared.every((m) => typeof m === "string" && m.length > 0))
  assert.equal(store.getState().engineState, "ready")
  assert.equal(store.getState().activeModelFolder, BIG)
})

test("ensurePrepared is a no-op (no prepare, no download) when nothing installed", async () => {
  const prepared: Array<string | undefined> = []
  const stt = {
    ...mockStt([]),
    prepare: async (o?: { model?: string }) => {
      prepared.push(o?.model)
      return { ready: false, model: o?.model ?? "" }
    },
  }
  store.setState({
    installedFolders: [],
    readiness: "modelMissing",
    activeModelFolder: null,
    preferredModelFolder: null,
    engineState: "idle",
  })
  await store.getState().ensurePrepared(stt)
  assert.deepEqual(prepared, [])
  assert.equal(store.getState().engineState, "idle")
})
