// Rung-3 distractor top-up wiring (W12 / content-resolver.md §4.2): the
// PRODUCTION buildResolverDeps must map ResolverDeps.getRandomEntries onto
// the host's FILTERED random-entries surface (hostApi.getRandomEntries
// options form, W5's wiring note) — forwarding {count, domains, levels} and
// constraining `languageCodes` to the resolve context's languages so drawn
// entries carry the faces phraseItemFromEntry needs. It must degrade to []
// (never throw / never reject) on a missing seam or a host error, and it
// must NOT reorder or filter the host's draw — the top-up only FEEDS the
// sampler pool; selection stays on the card PRNG inside distractors.ts.
//
// `runtimeWiring.ts` pulls the real host/store graph (extensionless imports,
// vite defines), so we bundle through esbuild like the other integration
// tests, stubbing ONLY `store/settings` (its module-level
// `persist.onFinishHydration` assumes a browser storage stack).

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import os from "node:os"

type EntryOutish = { entry_id: number; source?: string }
type Query = { count: number; domains?: string[]; levels?: string[] }
type HostQuery = number | (Query & { languageCodes?: string[] })

let buildResolverDeps: (
  hostApi: {
    getEntryById: (id: number, source: string) => Promise<EntryOutish | null>
    queryPackDb?: (q: unknown) => Promise<{ columns: string[]; rows: unknown[] }>
    getRandomEntries?: (q: HostQuery) => Promise<EntryOutish[]>
  },
  opts?: { randomEntryLanguages?: string[] },
) => { getRandomEntries: (q: Query) => Promise<EntryOutish[]> }

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))

  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "corpan-wiring-stub-"))
  fs.writeFileSync(
    path.join(stubDir, "settings.ts"),
    // Minimal shape: runtimeWiring only reads settings state lazily.
    "export const useSettingsStore: any = { getState: () => ({}), subscribe: () => () => {} }\n" +
      "export const ALL_TEXT_SIZES: any = []\n",
  )

  const res = await build({
    stdin: {
      contents: 'export { buildResolverDeps } from "./runtimeWiring.ts"',
      resolveDir: here,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    define: { "import.meta.env": "{}", __APP_VERSION__: '"0.0.0-test"' },
    plugins: [
      {
        name: "stub-settings-store",
        setup(b) {
          b.onResolve({ filter: /store\/settings$/ }, () => ({
            path: path.join(stubDir, "settings.ts"),
          }))
          b.onResolve({ filter: /^\.\/settings$/ }, (args) =>
            args.importer.replace(/\\/g, "/").includes("/src/store/")
              ? { path: path.join(stubDir, "settings.ts") }
              : undefined,
          )
        },
      },
    ],
    tsconfig: path.join(here, "../../tsconfig.json"),
  })
  const code = res.outputFiles[0].text
  const mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"))
  buildResolverDeps = mod.buildResolverDeps
})

const baseHost = {
  getEntryById: async () => null,
  queryPackDb: async () => ({ columns: [], rows: [] }),
}

test("rung-3 top-up forwards the filter to the host's options form + languageCodes from the stack", async () => {
  const calls: HostQuery[] = []
  const drawn = [{ entry_id: 11 }, { entry_id: 12 }, { entry_id: 13 }]
  const deps = buildResolverDeps(
    {
      ...baseHost,
      getRandomEntries: async (q) => {
        calls.push(q)
        return drawn
      },
    },
    { randomEntryLanguages: ["ja", "en"] },
  )

  const out = await deps.getRandomEntries({ count: 3, levels: ["A1"], domains: ["travel"] })

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], {
    count: 3,
    domains: ["travel"],
    levels: ["A1"],
    languageCodes: ["ja", "en"],
  })
  // Pool feed only: the host draw passes through untouched (order + content)
  // — selection/elimination stay on the card PRNG in distractors.ts.
  assert.deepEqual(out, drawn)
})

test("empty filter axes are omitted (the host's numeric-legacy semantics stay untouched)", async () => {
  const calls: HostQuery[] = []
  const deps = buildResolverDeps(
    {
      ...baseHost,
      getRandomEntries: async (q) => {
        calls.push(q)
        return []
      },
    },
    { randomEntryLanguages: [] },
  )
  await deps.getRandomEntries({ count: 5 })
  assert.deepEqual(calls[0], { count: 5 })
})

test("missing host seam resolves [] — a legacy HostApi never breaks a card", async () => {
  const deps = buildResolverDeps({ ...baseHost }, { randomEntryLanguages: ["en"] })
  assert.deepEqual(await deps.getRandomEntries({ count: 4, levels: ["A1"] }), [])
})

test("host error resolves [] — the sampler reports shortfall instead of crashing", async () => {
  const deps = buildResolverDeps(
    {
      ...baseHost,
      getRandomEntries: async () => {
        throw new Error("db locked")
      },
    },
    { randomEntryLanguages: ["en"] },
  )
  assert.deepEqual(await deps.getRandomEntries({ count: 4 }), [])
})
