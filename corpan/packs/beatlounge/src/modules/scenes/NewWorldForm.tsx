/**
 * beatlounge — the "New…" world form: turn one-tap Randomize into a controllable
 * roll. Each of the eight facets (meter, tempo, key, kit, the three voices,
 * groove) shows its current rolled value and a LOCK toggle; Reroll re-rolls every
 * unlocked facet (locked ones stay), and Create applies the draft as a fresh
 * empty-grid world (one undoable step). The roll/lock engine + build live in
 * startFresh (`rollDraftWorld` / `buildSnapshotFromDraft`, via the controller);
 * this is just the surface.
 */

import { useState } from "react"
import type { ScenesController } from "./scenesController"
import type { DraftFacet, DraftWorld } from "./startFresh"
import { Glyph } from "../../bl-ui"
import { ct } from "../../i18n/strings"
import { getPreset } from "../../instruments/presets"
import { getKit } from "../../kits"
import { getRhythm } from "../../rhythm"
import { SHARP_NAMES } from "../../music/harmony"

/** The facet rows, in display order, each with a human value read off the draft. */
const ROWS: { facet: DraftFacet; value: (d: DraftWorld) => string }[] = [
  { facet: "meter", value: (d) => `${d.meter.numerator}/${d.meter.denominator}` },
  { facet: "tempo", value: (d) => `${d.bpm} BPM` },
  { facet: "key", value: (d) => `${SHARP_NAMES[d.key.tonic]} ${d.key.mode.name}` },
  { facet: "kit", value: (d) => getKit(d.kitId)?.name ?? d.kitId },
  { facet: "bass", value: (d) => getPreset(d.voices.bass)?.name ?? d.voices.bass },
  { facet: "mid", value: (d) => getPreset(d.voices.mid)?.name ?? d.voices.mid },
  { facet: "lead", value: (d) => getPreset(d.voices.lead)?.name ?? d.voices.lead },
  { facet: "groove", value: (d) => getRhythm(d.grooveId)?.name ?? d.grooveId },
]

// Static ct keys (the i18n gate requires literals, not template strings).
const facetLabel = (f: DraftFacet): string => {
  switch (f) {
    case "meter":
      return ct("scenes.facet.meter")
    case "tempo":
      return ct("scenes.facet.tempo")
    case "key":
      return ct("scenes.facet.key")
    case "kit":
      return ct("scenes.facet.kit")
    case "bass":
      return ct("scenes.facet.bass")
    case "mid":
      return ct("scenes.facet.mid")
    case "lead":
      return ct("scenes.facet.lead")
    case "groove":
      return ct("scenes.facet.groove")
  }
}

interface Props {
  ctrl: ScenesController
  /** Create the world (already applied) — caller closes + toasts. */
  onCreate: () => void
  /** Dismiss without applying. */
  onCancel: () => void
}

export const NewWorldForm = ({ ctrl, onCreate, onCancel }: Props) => {
  const [draft, setDraft] = useState<DraftWorld>(() => ctrl.rollWorld())
  const [locks, setLocks] = useState<ReadonlySet<DraftFacet>>(() => new Set())

  const toggleLock = (f: DraftFacet) =>
    setLocks((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })

  const reroll = () => setDraft(ctrl.rollWorld({ from: draft, lock: locks }))
  // Per-facet reroll: roll just this facet, keep every other one (lock = all but f).
  // The dice is disabled while its facet is locked, so a locked facet never moves.
  const rerollFacet = (f: DraftFacet) =>
    setDraft(
      ctrl.rollWorld({ from: draft, lock: new Set(ROWS.map((r) => r.facet).filter((x) => x !== f)) })
    )
  const create = () => {
    ctrl.applyWorld(draft)
    onCreate()
  }

  return (
    <div className="bl-newworld" role="group" aria-label={ct("scenes.newTitle")}>
      <div className="bl-newworld-rows">
        {ROWS.map((r) => {
          const label = facetLabel(r.facet)
          const locked = locks.has(r.facet)
          return (
            <div key={r.facet} className="bl-newworld-row">
              <span className="bl-newworld-facet">{label}</span>
              <span className="bl-newworld-value" title={r.value(draft)}>
                {r.value(draft)}
              </span>
              <button
                type="button"
                className="bl-icon-btn bl-newworld-dice"
                aria-label={ct("scenes.rerollFacet", { facet: label })}
                disabled={locked}
                onClick={() => rerollFacet(r.facet)}
              >
                <Glyph name="dice" size={15} />
              </button>
              <button
                type="button"
                className={`bl-icon-btn bl-newworld-lock${locked ? " is-locked" : ""}`}
                aria-label={ct("scenes.lockFacet", { facet: label })}
                aria-pressed={locked}
                onClick={() => toggleLock(r.facet)}
              >
                <Glyph name="lock" size={15} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="bl-newworld-actions">
        <button type="button" className="bl-chip bl-newworld-reroll" onClick={reroll}>
          <Glyph name="dice" size={14} />
          <span>{ct("scenes.newReroll")}</span>
        </button>
        <button type="button" className="bl-chip bl-newworld-cancel" onClick={onCancel}>
          {ct("scenes.newCancel")}
        </button>
        <button type="button" className="bl-chip bl-newworld-create" onClick={create}>
          {ct("scenes.newCreate")}
        </button>
      </div>
    </div>
  )
}
