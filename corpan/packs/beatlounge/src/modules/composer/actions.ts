/**
 * beatlounge — composer module actions. Pure, deterministic-given-rng, and
 * LLM-callable. They mirror the `jam`/`progression` LLM tools so the command bus
 * indexes the same harmony surface across modules. Bound to the melodic "Synth"
 * track (first non-drumSampler instrument). Kept free of React for unit tests.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import { isInstrumentTrack } from "../../model/document"
import { parseNoteName, SCALE_NAMES, type ScaleName } from "../../music/harmony"
import { renderTemplate, TEMPLATE_NAMES } from "../../music/templates"
import { jam, progressionTicks, type JamFeel } from "../../music/jam"

const FEELS: readonly JamFeel[] = ["melody", "arp", "chords", "bass"]

/** Resolve the melodic track: the bound track, else the first non-drum synth. */
const synthTrackId = (ctx: ActionContext): string | undefined => {
  if (ctx.targetTrackId) return ctx.targetTrackId
  const synth = ctx.doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )
  return synth?.id
}

const registerForFeel = (feel: JamFeel): number =>
  feel === "bass" ? 48 : feel === "chords" ? 57 : 62

/**
 * jam — compose a directed part on the synth in a key + mode + feel over a named
 * progression template. Stochastic (the seed shapes the motif), so re-roll
 * varies it. Mirrors the `jam` LLM tool exactly.
 */
export const jamAction: ModuleAction = {
  name: "jam",
  describe: "Compose a melodic part in a key + mode + feel over a chord progression.",
  params: {
    key: { type: "string", default: "C", describe: "Tonic key, e.g. C, G, Eb." },
    mode: { type: "enum", options: SCALE_NAMES, default: "major", describe: "Scale/mode." },
    feel: { type: "enum", options: FEELS, default: "melody", describe: "melody, arp, chords, bass." },
    template: { type: "enum", options: TEMPLATE_NAMES, default: "pop", describe: "Named progression." },
    density: { type: "number", min: 0, max: 1, default: 0.55, describe: "How busy, 0–1." },
  },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const trackId = synthTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No synth track" }
    const keyPc = parseNoteName(String(params.key ?? "C")) ?? 0
    const mode = (SCALE_NAMES.includes(String(params.mode) as ScaleName)
      ? String(params.mode)
      : "major") as ScaleName
    const feel = (FEELS.includes(String(params.feel) as JamFeel)
      ? String(params.feel)
      : "melody") as JamFeel
    const template = TEMPLATE_NAMES.includes(String(params.template))
      ? String(params.template)
      : "pop"
    const density = Math.max(0, Math.min(1, Number(params.density ?? 0.55)))
    const seed = Math.floor(ctx.rng() * 0xffffffff) >>> 0
    const prog = renderTemplate(template, keyPc, mode)
    const notes = jam(prog, { feel, density, register: registerForFeel(feel), seed, velocity: 0.72 })
    if (!notes.length) return { commands: [], summary: "Nothing to jam" }
    return {
      commands: [
        {
          t: "batch",
          label: "Jam",
          commands: [
            { t: "setLoopLength", ticks: progressionTicks(prog) },
            { t: "setNotes", trackId, notes },
          ],
        },
      ],
      summary: `Jam · ${feel} (${notes.length} notes)`,
    }
  },
}

export const composerActions: ReadonlyArray<ModuleAction> = [jamAction]
