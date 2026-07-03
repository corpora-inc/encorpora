// src/journey/__smoke__/entry.tsx — the esbuild-bundled half of the
// JourneySurface smoke test (smoke.test.ts). Renders the REAL surface over
// the REAL engine + resolver, wired to the W6 fixture course pack via an
// injected query function (node:sqlite lives on the node side — it can't be
// bundled). The node side drives the DOM like a user.

import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { JourneySurface } from "../JourneySurface.tsx"
import { createJourneyEngine, createMemoryPersistence, systemClock } from "../engine/index.ts"
import type { CourseGraph, EngineCard } from "../engine/index.ts"
import { createResolver } from "../content/resolve.ts"
import type { PackDbResult, ResolveContext, ResolverDeps } from "../content/resolve.ts"
import { loadCourseGraph } from "../../util/journeyPack.ts"
import type { JourneyRuntime, JourneyRuntimeDeps } from "../runtime.ts"
import type { EntryOut } from "../../contentPacks/types.ts"
import { useJourneyStore } from "../../store/journey.ts"

export type SmokeQueryFn = (
  sql: string,
  params: unknown[],
  maxRows: number,
) => Promise<Array<Record<string, unknown>>>

export interface SmokeHandle {
  runtime: JourneyRuntime
  graph: CourseGraph
  currentEngineCard: () => EngineCard | null
}

const CTX: ResolveContext = { courseId: "journey_en", targetLang: "en", nativeLang: "es" }

function fixtureEntry(entryId: number, source: string): EntryOut {
  return {
    entry_id: entryId,
    level: "A1",
    domains: ["fixture"],
    source,
    translations: [
      { language_code: "en", text: `alpha bravo ${entryId}`, romanization: "" },
      { language_code: "es", text: `uno dos ${entryId}`, romanization: "" },
    ],
  }
}

function makeResolverDeps(query: SmokeQueryFn): ResolverDeps {
  return {
    getEntryById: async (entryId, source) => fixtureEntry(entryId, source),
    getRandomEntries: async () => [],
    queryPackDb: async (q): Promise<PackDbResult> => {
      const rows = await query(q.sql, q.params ?? [], q.maxRows ?? 2000)
      return { columns: rows[0] ? Object.keys(rows[0]) : [], rows }
    },
    fetchPackText: async () => {
      throw new Error("no pack files in smoke fixture")
    },
    packFileUrl: (packId, relPath) => `corpan-pack://localhost/${packId}/${relPath}`,
    findInstalledWordPack: () => null,
    findInstalledNarrationPack: () => null,
    findInstalledPack: (packId) => packId === "base",
    log: () => {},
  }
}

export async function mountSmoke(opts: {
  container: HTMLElement
  query: SmokeQueryFn
  onRuntime: (h: SmokeHandle) => void
}): Promise<void> {
  const graph = await loadCourseGraph((sql, params, maxRows) => opts.query(sql, params, maxRows))
  const resolverDeps = makeResolverDeps(opts.query)
  const resolver = createResolver(resolverDeps, CTX)
  const engine = createJourneyEngine({
    key: { stackId: "smoke-stack", courseId: graph.courseId },
    graph,
    persistence: createMemoryPersistence({ now: () => Date.now() }),
    clock: systemClock,
  })
  useJourneyStore.getState().setAdvanceMode("swipe")
  useJourneyStore.getState().setJuiceIntensity("minimal")
  const deps: JourneyRuntimeDeps = {
    engine,
    resolver,
    resolverDeps,
    ctx: CTX,
    graph,
    courseKey: "smoke-stack::journey_en",
    quota: { note: () => {}, remaining: () => 999, limit: () => 999, locked: () => false },
  }
  const root = createRoot(opts.container)
  root.render(
    createElement(JourneySurface, {
      deps,
      speak: async () => {},
      dir: "ltr",
      showRomanization: true,
      dailyGoal: 20,
      onRuntimeReady: (runtime: JourneyRuntime) =>
        opts.onRuntime({ runtime, graph, currentEngineCard: () => null }),
    }),
  )
}
