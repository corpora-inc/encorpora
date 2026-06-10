/**
 * beatlounge — the Composer IMMERSIVE view: the HARMONY/JAM surface.
 *
 * The user types a chord progression (the founder's comma-is-a-beat notation),
 * or picks a named template, sets key + mode + feel + density, and hits Jam /
 * Re-roll / Evolve. A live readout shows the PARSED progression (chord + beats)
 * so the notation always feels legible. All composing flows through the pure
 * `composeCommands` bridge as a single undo step onto the bound synth track.
 */

import { useMemo, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { applyCommands } from "../runAction"
import { Knob } from "../../bl-ui"
import { chordName } from "../../music/harmony"
import {
  COMPOSER_FEELS,
  COMPOSER_KEYS,
  COMPOSER_MODES,
  TEMPLATE_NAMES,
  composeCommands,
  defaultComposerSettings,
  nextEvolveSeed,
  resolveProgression,
  rollSeed,
  type ComposerSettings,
} from "./composerState"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

/** A spoken label for a scale name (e.g. "harmonicMinor" → "harmonic minor"). */
const modeLabel = (m: string): string =>
  m.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()

export const ComposerImmersive = ({ host, store, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [settings, setSettings] = useState<ComposerSettings>(defaultComposerSettings)

  const patch = (p: Partial<ComposerSettings>) => setSettings((s) => ({ ...s, ...p }))

  // The parsed progression drives the readout (live, off the current settings).
  const prog = useMemo(() => resolveProgression(settings), [settings])

  const compose = (seed: number, label: string) => {
    const next = { ...settings, seed }
    setSettings(next)
    const { commands, noteCount, chordCount } = composeCommands(next, trackId)
    if (!commands.length) {
      host.toast("Nothing to compose")
      return
    }
    const before = store.vanilla.getState().doc
    applyCommands(store, commands, label)
    host.toast(`${label}: ${noteCount} notes over ${chordCount} chords`, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  const onJam = () => compose(settings.seed || rollSeed(), "Jam")
  const onReroll = () => compose(rollSeed(), "Re-roll")
  const onEvolve = () => compose(nextEvolveSeed(settings.seed || 1), "Evolve")

  if (!track || !isInstrumentTrack(track)) {
    return <div className="bl-grid-empty">No synth track to compose onto.</div>
  }

  return (
    <div className="bl-cmp">
      <div className="bl-cmp-head" data-bl-nocapture>
        <span className="bl-cmp-title">Composer</span>
        <span className="bl-cmp-sub">{track.name}</span>
      </div>

      {/* Progression notation — the power-user path. */}
      <label className="bl-cmp-field" data-bl-nocapture>
        <span className="bl-cmp-label">Progression</span>
        <textarea
          className="bl-cmp-text"
          value={settings.text}
          spellCheck={false}
          rows={2}
          placeholder="Dmin,,,,Gmin,,A7,,  (commas are beats — leave blank to use a template)"
          onChange={(e) => patch({ text: e.target.value })}
        />
      </label>

      {/* Template + key + mode + feel pickers (the closed-set path). */}
      <div className="bl-cmp-rows" data-bl-nocapture>
        <Picker
          label="Template"
          value={settings.template}
          options={TEMPLATE_NAMES}
          disabled={settings.text.trim().length > 0}
          onChange={(v) => patch({ template: v })}
        />
        <Picker
          label="Key"
          value={settings.key}
          options={COMPOSER_KEYS}
          onChange={(v) => patch({ key: v as ComposerSettings["key"] })}
        />
        <Picker
          label="Mode"
          value={settings.mode}
          options={COMPOSER_MODES}
          format={modeLabel}
          onChange={(v) => patch({ mode: v as ComposerSettings["mode"] })}
        />
        <Picker
          label="Feel"
          value={settings.feel}
          options={COMPOSER_FEELS}
          onChange={(v) => patch({ feel: v as ComposerSettings["feel"] })}
        />
      </div>

      <div className="bl-cmp-knobs" data-bl-nocapture>
        <Knob
          label="Density"
          value={settings.density}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.55}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => patch({ density: v })}
        />
        <div className="bl-cmp-buttons">
          <button type="button" className="bl-chip is-primary" onClick={onJam}>
            Jam
          </button>
          <button type="button" className="bl-chip" onClick={onReroll}>
            Re-roll
          </button>
          <button type="button" className="bl-chip" onClick={onEvolve}>
            Evolve
          </button>
        </div>
      </div>

      {/* Live parsed readout. */}
      <div className="bl-cmp-readout" data-bl-nocapture>
        <span className="bl-cmp-readout-label">
          {prog.chords.length} chords · {prog.totalBeats} beats
        </span>
        <div className="bl-cmp-chips">
          {prog.chords.map((c, i) => (
            <span className="bl-cmp-chord" key={i}>
              <span className="bl-cmp-chord-name">{chordName(c.chord)}</span>
              <span className="bl-cmp-chord-beats">{c.beats}</span>
            </span>
          ))}
          {prog.chords.length === 0 && (
            <span className="bl-cmp-empty">Type a progression or pick a template.</span>
          )}
        </div>
      </div>
    </div>
  )
}

interface PickerProps {
  label: string
  value: string
  options: readonly string[]
  disabled?: boolean
  format?: (v: string) => string
  onChange: (v: string) => void
}

/** A compact labelled <select> styled with --bl-* tokens. */
const Picker = ({ label, value, options, disabled, format, onChange }: PickerProps) => (
  <label className={"bl-cmp-pick" + (disabled ? " is-disabled" : "")}>
    <span className="bl-cmp-pick-label">{label}</span>
    <select
      className="bl-cmp-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {format ? format(o) : o}
        </option>
      ))}
    </select>
  </label>
)
