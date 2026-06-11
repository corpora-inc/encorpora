/**
 * beatlounge — Grooves module actions. Pure, deterministic-given-rng, and
 * LLM-callable. They SCATTER a world rhythm across the host's grid — drums OR
 * phrases — through existing commands, as ONE undo batch.
 *
 * THE ACTION SET IS DELIBERATELY TWO:
 *   • scatter      — the PRIMARY action. Probabilistically spread the groove's
 *                    feel across the selected rows (or play it on its natural
 *                    voices when nothing is selected), LEAVING existing notes.
 *                    Each call re-rolls (ctx.rng is fresh-seeded per call), so
 *                    pressing again gives a different, surprising result.
 *   • clearScatter — the same scatter, but CLEAR the targeted rows first (the
 *                    old "Apply" reduced to "clear + scatter").
 *
 * Vary / Evolve / Randomize are GONE: the variation is baked into scatter (every
 * press re-rolls), and "randomize" had nothing to do with the chosen groove. The
 * groove is addressed by `rhythmId` so the LLM can drive "scatter samba over
 * these rows", "clear and scatter a clave".
 *
 * Kept free of React so they're unit-testable in isolation.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import { getRhythm, RHYTHMS } from "../../rhythm"
import { buildGrooveCommands, type GrooveBuildOpts, type GrooveTarget } from "./grooveModel"

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
  density: {
    type: "number" as const,
    min: 0,
    max: 1,
    default: 1,
    describe: "Scatter density — scales each step's placement chance. 1 = full feel, lower = sparser.",
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
  ctx: ActionContext,
  clear: boolean
): GrooveBuildOpts => ({
  target: resolveTarget(params),
  intensity: Number(params.intensity ?? 1),
  density: params.density != null ? Number(params.density) : undefined,
  clear,
  // ctx.rng is fresh-seeded per call (reroll = a new seed), so each scatter
  // press is different. The UI also passes an explicit per-press `seed`.
  rng: ctx.rng,
  seed: params.seed != null ? Number(params.seed) : undefined,
  phraseDensity: params.phraseDensity != null ? Number(params.phraseDensity) : undefined,
})

const resolveRhythmId = (params: Record<string, unknown>): string =>
  typeof params.rhythmId === "string" && params.rhythmId ? params.rhythmId : DEFAULT_RHYTHM_ID

/**
 * scatter — the PRIMARY action. Spread the groove probabilistically across the
 * selected rows (or play it on its natural voices when nothing is selected),
 * LEAVING existing notes. Re-rolls every call (stochastic) → press again for a
 * fresh, surprising result.
 */
export const scatterAction: ModuleAction = {
  name: "scatter",
  describe:
    "Scatter a world rhythm (clave, samba, reggaetón, teental…) probabilistically across the selected rows; re-rolls every press. Leaves existing notes.",
  params: { ...sharedParams },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const { commands, summary } = buildGrooveCommands(ctx.doc, r, buildOpts(params, ctx, false))
    return { commands, summary }
  },
}

/**
 * clearScatter — the same scatter, but CLEAR the targeted rows first (the
 * selected voices, or the groove's natural voices when nothing is selected).
 * This is the old "Apply" reduced to "clear + scatter".
 */
export const clearScatterAction: ModuleAction = {
  name: "clearScatter",
  describe:
    "Clear the targeted rows, then scatter the world rhythm across them probabilistically. Re-rolls every press.",
  params: { ...sharedParams },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const { commands, summary } = buildGrooveCommands(ctx.doc, r, buildOpts(params, ctx, true))
    return { commands, summary }
  },
}

export const groovesActions: ReadonlyArray<ModuleAction> = [
  scatterAction,
  clearScatterAction,
]
