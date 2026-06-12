/**
 * beatlounge — Grooves module actions. Pure, deterministic-given-rng, and
 * LLM-callable. They SCATTER a world rhythm across the host's grid — drums OR
 * phrases — through existing commands, as ONE undo batch.
 *
 * THE PRIMARY SURFACE IS A +/− DENSITY DIAL:
 *   • denser  — "+": lay ONE more probabilistic layer of the groove on the
 *                targeted rows (ADDITIVE, gradually denser; re-rolls each tap).
 *                Phrases land far sparser than drums (a + drops a few words).
 *   • sparser — "−": remove a fraction of the current hits (off-beat/quiet
 *                first), each tap thinner, down to nothing. Pure; a smaller bite
 *                than + (harder to take away than to add).
 *
 * scatter / clearScatter remain for the LLM command bus + back-compat (the old
 * probabilistic spread + clear-then-spread); the UI dial drives denser/sparser.
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
    const p = t as { trackId?: unknown; selectedSnippetIds?: unknown }
    return {
      kind: "phrases",
      trackId: typeof p.trackId === "string" ? p.trackId : undefined,
      selectedSnippetIds: Array.isArray(p.selectedSnippetIds)
        ? p.selectedSnippetIds.map(String)
        : undefined,
    }
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

/** Build opts for the +/− density dial — carries the op; never clears. */
const buildDialOpts = (
  params: Record<string, unknown>,
  ctx: ActionContext,
  op: "add" | "remove" | "generate"
): GrooveBuildOpts => ({
  target: resolveTarget(params),
  intensity: Number(params.intensity ?? 1),
  op,
  // "+" re-rolls a fresh layer each tap (seeded for reproducibility); "−" is pure
  // selection (no RNG). The per-tap density increments live in grooveModel.
  rng: ctx.rng,
  seed: params.seed != null ? Number(params.seed) : undefined,
  // The generator DENSITY LEVEL for op:"generate" (the home/Drums dial).
  level: params.level != null ? Number(params.level) : undefined,
  // Allow an explicit override (tests / LLM), else grooveModel's per-tap steps.
  density: params.density != null ? Number(params.density) : undefined,
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

/**
 * denser — the "+" of the density dial. Lay ONE more probabilistic layer of the
 * groove onto the targeted rows (ADDITIVE: keeps what's there, adds more hits per
 * the groove's profile, at a per-tap density increment). Re-rolls every tap, so
 * repeated + gradually + variably densifies. For PHRASES the per-tap density is
 * dramatically lower than drums — a + drops only a handful of well-placed words.
 */
export const denserAction: ModuleAction = {
  name: "denser",
  describe:
    "Layer one more probabilistic pass of the world rhythm onto the targeted rows — additive, gradually denser. Phrases land far sparser than drums.",
  params: { ...sharedParams },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const { commands, summary } = buildGrooveCommands(ctx.doc, r, buildDialOpts(params, ctx, "add"))
    return { commands, summary }
  },
}

/**
 * generate — the +/− dial's PRIMARY drum action. REGENERATE a fresh stochastic
 * beat across the WHOLE kit (or the selected rows) at a density `level`. Every
 * press is a brand-new beat (fresh seed) spread over every drum row — kick on the
 * downbeats, snare on the backbeats, hats subdividing, perc colour — flavoured by
 * the chosen groove. "+" raises the level (denser); "−" lowers it; level 0 = empty.
 * This is the founder's "+ makes an all-new beat", NOT a stale stock pattern.
 */
export const generateAction: ModuleAction = {
  name: "generate",
  describe:
    "Generate a fresh stochastic drum beat across the whole kit at a density level — a brand-new musical beat every press, flavoured by the chosen world rhythm.",
  params: {
    ...sharedParams,
    level: {
      type: "number" as const,
      min: 0,
      max: 12,
      default: 1,
      describe: "Density level: 0 = empty, 1 ≈ five hits, higher = denser.",
    },
  },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const { commands, summary } = buildGrooveCommands(ctx.doc, r, buildDialOpts(params, ctx, "generate"))
    return { commands, summary }
  },
}

/**
 * sparser — the "−" of the density dial. Remove a fraction of the targeted rows'
 * current hits (lowest-emphasis / off-beat first), each tap thinner, down to
 * nothing. Pure (no RNG). Asymmetric: a − removes a smaller bite than a + adds,
 * so it's "harder to take away than to add".
 */
export const sparserAction: ModuleAction = {
  name: "sparser",
  describe:
    "Thin the targeted rows — remove a fraction of the current hits (off-beat/quiet first), down to nothing. Pure; smaller bite than +.",
  params: { ...sharedParams },
  stochastic: false,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const r = getRhythm(resolveRhythmId(params))
    if (!r) return { commands: [], summary: "Unknown rhythm" }
    const { commands, summary } = buildGrooveCommands(ctx.doc, r, buildDialOpts(params, ctx, "remove"))
    return { commands, summary }
  },
}

export const groovesActions: ReadonlyArray<ModuleAction> = [
  generateAction,
  denserAction,
  sparserAction,
  scatterAction,
  clearScatterAction,
]
