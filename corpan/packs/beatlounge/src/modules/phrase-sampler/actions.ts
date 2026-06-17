/**
 * beatlounge — phrase-sampler module actions. Pure, deterministic, LLM-callable.
 *
 * The corpus fetch + audio resolution are async and happen in the immersive
 * browser (a UI gesture); a ModuleAction must be SYNCHRONOUS + pure over the
 * doc. So the one action here, `placePhraseText`, places a phrase the LLM
 * already has the TEXT for (it knows the target language + word), using the
 * synth-vox FLOOR tier so the cell performs immediately. A later trigger lazily
 * upgrades to real TTS bytes if the AudioSource has them cached. This keeps the
 * action reproducible (undo is exact) while still letting "drop the word agua as
 * a riff" work by natural language.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import { buildSynthVoxClip, clipToCommands, type ClipMode } from "../../phrase/pipeline"
import { ct } from "../../i18n/strings"

const asMode = (v: unknown): ClipMode => (v === "scatter" ? "scatter" : "stack")

/** placePhraseText — drop a phrase (LLM supplies the text + lang) as a sampler. */
export const placePhraseTextAction: ModuleAction = {
  name: "placePhraseText",
  describe:
    "Place a phrase or word as a phrase-sampler track. mode 'stack' re-pitches one word up the scale (a riff); 'scatter' lays each word across the bar.",
  params: {
    text: { type: "string", describe: "The phrase / word text in the target language." },
    lang: { type: "string", describe: "Target language code (e.g. 'es', 'ja')." },
    mode: {
      type: "enum",
      options: ["stack", "scatter"] as const,
      default: "stack",
      describe: "stack = one word up the scale (riff); scatter = phrase across the bar.",
    },
  },
  impact: "mutate",
  run(ctx: ActionContext, params: Record<string, unknown>): ActionResult {
    const text = String(params.text ?? "").trim()
    const lang = String(params.lang ?? "").trim()
    if (!text || !lang) {
      return { commands: [], summary: ct("phrases.needTextAndLang") }
    }
    const mode = asMode(params.mode)
    const clip = buildSynthVoxClip({
      text,
      targetLang: lang,
      grid: { denominator: 16 },
      loopTicks: ctx.doc.loopLengthTicks,
      mode,
    })
    const commands = clipToCommands(clip)
    return {
      commands: commands.length
        ? [{ t: "batch", commands, label: ct("phrases.placeLabel", { text }) }]
        : [],
      summary:
        mode === "stack"
          ? ct("phrases.riffSummary", { text })
          : ct("phrases.phraseSummary", { text, n: String(clip.fragments.length) }),
    }
  },
}

export const phraseSamplerActions: ReadonlyArray<ModuleAction> = [placePhraseTextAction]
