/**
 * beatlounge — Grooves module actions. Pure, deterministic-given-rng, and
 * LLM-callable. They apply a world rhythm (or a vary/evolve/randomize of it) to
 * whatever GRID the host points the brain at — drums OR phrases — through
 * existing commands, as ONE undo batch. The current groove is addressed by
 * `rhythmId` so the LLM can drive "apply samba", "vary the current groove",
 * "evolve it 4 steps", "randomize a Caribbean beat".
 *
 * v1 variation is fully ALGORITHMIC/seeded (engine.ts). The LLM-as-artist hook
 * is future — these actions are the surface it will later call.
 *
 * Kept free of React so they're unit-testable in isolation.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import { getRhythm, evolveRhythm, randomizeRhythm, varyRhythm, RHYTHMS } from "../../rhythm"
import type { RhythmFamily } from "../../rhythm"
import { buildGrooveCommands, type GrooveBuildOpts, type GrooveTarget } from "./grooveModel"

const FAMILY_OPTIONS = [
  "afro-cuban",
  "brazilian",
  "caribbean",
  "north-american",
  "electronic",
  "african",
  "european",
  "middle-eastern",
  "indian",
] as const

const DEFAULT_RHYTHM_ID = RHYTHMS[0]?.id ?? "son-clave-3-2"

const sharedParams = {
  rhythmId: {
    type: "string" as const,
    default: DEFAULT_RHYTHM_ID,
    describe: "The world-rhythm id to operate on (e.g. 'samba', 'son-clave-3-2', 'teental').",
  },
  intensity: {
    type: "number" as const,
    min: 0,
    max: 1,
    default: 1,
    describe: "Scale all hit velocities; 1 = as written, lower = gentler.",
  },
}

/** Coerce an unknown selected-pitches list into a finite-number array (or undefined). */
const coerceTargets = (v: unknown): number[] | undefined => {
  if (!Array.isArray(v)) return undefined
  const out = v.map(Number).filter((n) => Number.isFinite(n))
  return out.length > 0 ? out : undefined
}

/**
 * Resolve the GROOVE TARGET from the params. The host passes a typed `target`
 * (`{kind:"drums",...}` / `{kind:"phrases",...}`); for LLM/back-compat we also
 * accept a flat `targetKind` + `selectedPitches`/`targetTrackId`. Defaults to a
 * drums target so legacy callers keep their behaviour.
 */
const resolveTarget = (params: Record<string, unknown>): GrooveTarget => {
  const t = params.target
  if (t && typeof t === "object" && (t as { kind?: string }).kind === "phrases") {
    const trackId = (t as { trackId?: unknown }).trackId
    return { kind: "phrases", trackId: typeof trackId === "string" ? trackId : undefined }
  }
  if (t && typeof t === "object" && (t as { kind?: string }).kind === "drums") {
    const d = t as { trackId?: unknown; selectedPitches?: unknown; laneLabels?: unknown }
    return {
      kind: "drums",
      trackId: typeof d.trackId === "string" ? d.trackId : undefined,
      selectedPitches: coerceTargets(d.selectedPitches),
      laneLabels: Array.isArray(d.laneLabels) ? d.laneLabels.map(String) : undefined,
    }
  }
  // Flat fallback (LLM): targetKind + selectedPitches.
  if (params.targetKind === "phrases") {
    return { kind: "phrases", trackId: typeof params.targetTrackId === "string" ? params.targetTrackId : undefined }
  }
  return { kind: "drums", selectedPitches: coerceTargets(params.selectedPitches ?? params.targetPitches) }
}

const buildOpts = (
  params: Record<string, unknown>,
  ctx: ActionContext
): GrooveBuildOpts => ({
  target: resolveTarget(params),
  intensity: Number(params.intensity ?? 1),
  layer: Boolean(params.layer),
  rng: ctx.rng,
  phraseDensity: params.phraseDensity != null ? Number(params.phraseDensity) : undefined,
})

const resolveRhythmId = (params: Record<string, unknown>): string =>
  typeof params.rhythmId === "string" && params.rhythmId ? params.rhythmId : DEFAULT_RHYTHM_ID

/** apply — write a world rhythm onto the drum track. */
export const applyAction: ModuleAction = {
  name: "apply",
  describe: "Apply a world rhythm (clave, samba, reggaetón, teental…) to the drum track.",
  params: { ...sharedParams },
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const { commands, summary } = buildGrooveCommands(ctx.doc, r, buildOpts(params, ctx))
    return { commands, summary: `Applied ${summary}` }
  },
}

/** layer — apply a world rhythm ADDITIVELY (union with the existing pattern). */
export const layerAction: ModuleAction = {
  name: "layer",
  describe: "Layer a world rhythm onto the drum track — stack it OVER the current pattern (don't replace).",
  params: { ...sharedParams },
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const { commands, summary } = buildGrooveCommands(ctx.doc, r, {
      ...buildOpts(params, ctx),
      layer: true,
    })
    return { commands, summary: `Layered ${summary}` }
  },
}

/** vary — keep the flavor, make small changes to the named groove. */
export const varyAction: ModuleAction = {
  name: "vary",
  describe: "Vary the groove: keep its flavor (backbone) but make small changes.",
  params: {
    ...sharedParams,
    amount: {
      type: "number",
      min: 0,
      max: 1,
      default: 0.25,
      describe: "How much to change (small). The signature pattern is preserved.",
    },
  },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const varied = varyRhythm(r, ctx.rng, Number(params.amount ?? 0.25))
    const { commands } = buildGrooveCommands(ctx.doc, varied, buildOpts(params, ctx))
    return { commands, summary: `Varied ${r.name}` }
  },
}

/** evolve — iteratively vary so the groove drifts further while staying musical. */
export const evolveAction: ModuleAction = {
  name: "evolve",
  describe: "Evolve the groove: drift it further across several generations (still musical).",
  params: {
    ...sharedParams,
    generations: {
      type: "int",
      min: 1,
      max: 16,
      default: 4,
      describe: "How many vary steps to chain (more = further from the original).",
    },
    amount: {
      type: "number",
      min: 0,
      max: 1,
      default: 0.2,
      describe: "Per-generation step size (small).",
    },
  },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const gens = Math.max(1, Math.round(Number(params.generations ?? 4)))
    const evolved = evolveRhythm(r, ctx.rng, gens, Number(params.amount ?? 0.2))
    const { commands } = buildGrooveCommands(ctx.doc, evolved, buildOpts(params, ctx))
    return { commands, summary: `Evolved ${r.name} · ${gens} gens` }
  },
}

/** randomize — a full re-roll within a family (or the whole corpus). */
export const randomizeAction: ModuleAction = {
  name: "randomize",
  describe: "Randomize: re-roll a fresh groove (optionally within one family).",
  params: {
    family: {
      type: "enum",
      options: FAMILY_OPTIONS,
      describe: "Restrict the re-roll to one groove family; omit for the whole world.",
    },
    vary: {
      type: "number",
      min: 0,
      max: 1,
      default: 0,
      describe: "Apply this much vary on top of the picked rhythm (0 = pristine).",
    },
    intensity: sharedParams.intensity,
  },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const family =
      typeof params.family === "string" && FAMILY_OPTIONS.includes(params.family as never)
        ? (params.family as RhythmFamily)
        : undefined
    const r = randomizeRhythm(ctx.rng, { family, vary: Number(params.vary ?? 0) })
    const { commands, summary } = buildGrooveCommands(ctx.doc, r, buildOpts(params, ctx))
    return { commands, summary: `Randomized · ${summary}` }
  },
}

export const groovesActions: ReadonlyArray<ModuleAction> = [
  applyAction,
  layerAction,
  varyAction,
  evolveAction,
  randomizeAction,
]
