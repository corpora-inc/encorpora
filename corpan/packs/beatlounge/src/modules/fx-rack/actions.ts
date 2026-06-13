/**
 * beatlounge — fx-rack module actions. Pure, LLM-callable insert-chain edits
 * that also back the immersive rack's buttons. Each returns the commands the
 * bus applies in one undo step plus a human summary. No React, so unit-testable.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"
import type { EffectKind } from "../../model/document"
import { findTrack } from "../../model/document"
import { EFFECT_KINDS, EFFECT_SPECS, defaultEffectParams } from "../../effects/params"
import { ct } from "../../i18n/strings"

/** Resolve the track this rack is bound to (else the first track). */
const targetTrackId = (ctx: ActionContext): string | undefined =>
  ctx.targetTrackId ?? ctx.doc.tracks[0]?.id

/** addInsert — append an effect of `kind` to the bound track's chain. */
export const addInsertAction: ModuleAction = {
  name: "addInsert",
  describe: ct("fx.action.addInsert.describe"),
  params: {
    kind: {
      type: "enum",
      options: EFFECT_KINDS,
      default: "filter",
      describe: "Effect type to insert.",
    },
  },
  impact: "mutate",
  run(ctx, params): ActionResult {
    const trackId = targetTrackId(ctx)
    if (!trackId) return { commands: [], summary: ct("fx.noTrackShort") }
    const kind = (
      EFFECT_KINDS.includes(params.kind as EffectKind) ? params.kind : "filter"
    ) as EffectKind
    return {
      commands: [
        {
          t: "addInsert",
          trackId,
          effect: { kind, enabled: true, params: defaultEffectParams(kind) },
        },
      ],
      summary: ct("fx.addedEffect", { name: EFFECT_SPECS[kind].label }),
    }
  },
}

/** clearInserts — remove every insert from the bound track. Destructive. */
export const clearInsertsAction: ModuleAction = {
  name: "clearInserts",
  describe: ct("fx.action.clearInserts.describe"),
  params: {},
  impact: "destructive",
  run(ctx): ActionResult {
    const trackId = targetTrackId(ctx)
    if (!trackId) return { commands: [], summary: ct("fx.noTrackShort") }
    const track = findTrack(ctx.doc, trackId)
    const inserts = track?.inserts ?? []
    if (inserts.length === 0) return { commands: [], summary: ct("fx.noEffects") }
    const commands: Command[] = inserts.map((fx) => ({
      t: "removeInsert",
      trackId,
      insertId: fx.id,
    }))
    return {
      commands: [{ t: "batch", commands, label: ct("fx.clearEffects") }],
      summary: ct("fx.removedEffects", { n: String(inserts.length) }),
    }
  },
}

export const fxRackActions: ReadonlyArray<ModuleAction> = [
  addInsertAction,
  clearInsertsAction,
]
