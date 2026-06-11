/**
 * beatlounge — synth-analog IMMERSIVE view: the premium sound-design surface.
 *
 *  • Track switcher (chips) + "Make analog" when the track isn't one yet.
 *  • Preset picker (init / fat bass / warm pad / acid lead / pluck + custom).
 *  • Oscillators: wave selects, mix/detune/sub/noise knobs.
 *  • Filter: a big Cutoff × Resonance XYPad (the marquee control) + type, env
 *    amount, key-tracking, and the filter ADSR.
 *  • Amp ADSR + drive + level.
 *  • Modulation: LFO rate/depth/target + glide + voice mode.
 *  • A playable keyboard strip to audition the patch (tap → trigger).
 *
 * Knobs/XYPad move LIVE through the instrument's setParam (immediate sound),
 * and commit ONE setInstrument per gesture (one undo step), mirroring fx-rack.
 */

import { useEffect, useReducer, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import {
  findTrack,
  isInstrumentTrack,
  type BeatloungeDoc,
  type Id,
  type InstrumentConfig,
  type Track,
} from "../../model/document"
import { newInstrumentTrackInit } from "../instruments/addTrack"
import { Knob, XYPad } from "../../bl-ui"
import {
  ANALOG_PRESET_NAMES,
  ANALOG_WAVES,
  FILTER_TYPES,
  LFO_TARGETS,
  VOICE_MODES,
  analogSpec,
  defaultAnalogParams,
  numParam,
  resolveAnalogPreset,
  type AnalogParams,
} from "../../instruments/analogSynth"
import { Keyboard } from "./Keyboard"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  /** The bound MELODIC track, or undefined when the song has none yet (the
   *  surface then creates a fresh synth track instead of touching drums). */
  trackId?: Id
}

/** A melodic (non-drum) instrument track. The analog synth lives ONLY among
 *  these — a drumSampler track is never a valid target (clobber guard). */
const isMelodicTrack = (t: Track): boolean =>
  isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"

const fmtFreq = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(2)}k` : v.toFixed(0))
const fmtSec = (v: number): string => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`)
const fmtPct = (v: number): string => `${Math.round(v * 100)}`

export const SynthAnalogImmersive = ({ host, store, trackId: initialTrackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const [trackId, setTrackId] = useState<Id | undefined>(initialTrackId)
  // Force a re-render while a knob/XYPad gesture updates liveRef (the puck/dial
  // tracks the finger locally; we don't dispatch a command per move).
  const [, bump] = useReducer((x: number) => x + 1, 0)

  // Resolve the bound MELODIC track. NEVER fall back to a drum track — the
  // analog synth must not target or clobber drums.
  const bound = trackId ? findTrack(doc, trackId) : undefined
  const track =
    bound && isMelodicTrack(bound) ? bound : doc.tracks.find(isMelodicTrack)

  // If the selected track vanished or wasn't melodic, re-bind to the resolved
  // melodic track so the switcher highlight stays correct.
  useEffect(() => {
    if (track && track.id !== trackId) setTrackId(track.id)
  }, [track, trackId])

  // No melodic track yet: "Make analog" must CREATE a fresh synth track and
  // target THAT — it must NEVER repurpose the drum track.
  const createAndMakeAnalog = (preset = "init") => {
    const melodicCount = doc.tracks.filter(isMelodicTrack).length
    const init = newInstrumentTrackInit(melodicCount)
    store.dispatch({ t: "addTrack", track: init })
    if (init.id) {
      setTrackId(init.id)
      store.dispatch({
        t: "setInstrument",
        trackId: init.id,
        config: { kind: "analogSynth", preset, params: resolveAnalogPreset(preset) },
      })
      host.toast(`Analog synth · ${preset}`)
    } else {
      // newInstrumentTrackInit always pre-seeds an id; loud if that ever breaks.
      console.error("[synth-analog] new track init missing id; cannot make analog")
      host.toast("Couldn't add a synth track")
    }
  }

  if (!track) {
    return (
      <div className="bl-synth">
        <div className="bl-synth-makeanalog">
          <p className="bl-synth-makeanalog-copy">
            No synth track yet. Add one and make it analog.
          </p>
          <div className="bl-synth-presetchips">
            {ANALOG_PRESET_NAMES.map((p) => (
              <button
                key={p}
                type="button"
                className="bl-chip"
                onClick={() => createAndMakeAnalog(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const inst = track.instrument
  const analog = inst.kind === "analogSynth" ? inst : null
  const isAnalog = analog != null
  const presetName = analog?.preset ?? "init"
  const params: AnalogParams = analog
    ? { ...defaultAnalogParams(), ...analog.params }
    : defaultAnalogParams()

  // Live drag values (so knob/XYPad gestures don't spam undo). Null = mirror doc.
  const liveRef = useRef<AnalogParams>({})

  const makeAnalog = (preset = "init") => {
    store.dispatch({
      t: "setInstrument",
      trackId: track.id,
      config: { kind: "analogSynth", preset, params: resolveAnalogPreset(preset) },
    })
    host.toast(`Analog synth · ${preset}`)
  }

  const applyPreset = (preset: string) => {
    store.dispatch({
      t: "setInstrument",
      trackId: track.id,
      config: { kind: "analogSynth", preset, params: resolveAnalogPreset(preset) },
    })
  }

  // Build the next full config from the current params + an override patch.
  const configWith = (patch: AnalogParams, preset: string): InstrumentConfig => ({
    kind: "analogSynth",
    preset,
    params: { ...params, ...liveRef.current, ...patch },
  })

  // Live (per-move): drive the instrument node in REAL TIME via host.applyParam
  // (the analog synth's setParam ramps cutoff/resonance/drive/level/etc. on the
  // live voices) AND track the value locally so the dial/puck follows the finger
  // — NO command per move (no undo spam). The single setInstrument lands on
  // release, so the whole gesture is ONE undo step (mirrors fx-rack).
  const live = (key: string, value: number) => {
    liveRef.current[key] = value
    host.applyParam({ scope: "instrument", trackId: track.id, param: key }, value)
    bump()
  }

  // Editing ANY param means the patch no longer matches the stock preset, so
  // every committed tweak relabels the patch "custom" (mirrors hardware synths).
  const commit = (key: string, value: number | string | boolean) => {
    store.dispatch({
      t: "setInstrument",
      trackId: track.id,
      config: configWith({ [key]: value }, "custom"),
    })
    liveRef.current = {}
  }

  // XYPad commit writes two params in one setInstrument.
  const commitPair = (a: [string, number], b: [string, number]) => {
    store.dispatch({
      t: "setInstrument",
      trackId: track.id,
      config: configWith({ [a[0]]: a[1], [b[0]]: b[1] }, "custom"),
    })
    liveRef.current = {}
  }

  const val = (key: string): number =>
    (liveRef.current[key] as number | undefined) ?? numParam(params, key)

  if (!isAnalog) {
    return (
      <div className="bl-synth">
        <TrackBar doc={doc} track={track} setTrackId={setTrackId} />
        <div className="bl-synth-makeanalog">
          <p className="bl-synth-makeanalog-copy">
            Turn <strong>{track.name}</strong> into the analog synth.
          </p>
          <div className="bl-synth-presetchips">
            {ANALOG_PRESET_NAMES.map((p) => (
              <button key={p} type="button" className="bl-chip" onClick={() => makeAnalog(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bl-synth">
      <TrackBar doc={doc} track={track} setTrackId={setTrackId} />

      {/* ---- preset picker ---- */}
      <div className="bl-synth-presets" data-bl-nocapture>
        <span className="bl-synth-section-label">Preset</span>
        <div className="bl-synth-presetchips">
          {ANALOG_PRESET_NAMES.map((p) => (
            <button
              key={p}
              type="button"
              className={`bl-chip${presetName === p ? " is-on" : ""}`}
              onClick={() => applyPreset(p)}
            >
              {p}
            </button>
          ))}
          {presetName === "custom" && <span className="bl-synth-customtag">custom</span>}
        </div>
      </div>

      <div className="bl-synth-grid">
        {/* ---- oscillators ---- */}
        <section className="bl-synth-panel">
          <h3 className="bl-synth-panel-title">Oscillators</h3>
          <div className="bl-synth-row">
            <WaveSelect label="Osc 1" value={String(params.osc1Wave)} onChange={(v) => commit("osc1Wave", v)} />
            <WaveSelect label="Osc 2" value={String(params.osc2Wave)} onChange={(v) => commit("osc2Wave", v)} />
          </div>
          <div className="bl-synth-knobs">
            <ParamKnob k="oscMix" v={val("oscMix")} fmt={fmtPct} live={live} commit={commit} />
            <ParamKnob k="osc2Semi" v={val("osc2Semi")} fmt={(x) => `${Math.round(x)}`} live={live} commit={commit} />
            <ParamKnob k="osc2Detune" v={val("osc2Detune")} fmt={(x) => x.toFixed(0)} live={live} commit={commit} />
            <ParamKnob k="pulseWidth" v={val("pulseWidth")} fmt={fmtPct} live={live} commit={commit} />
            <ParamKnob k="subLevel" v={val("subLevel")} fmt={fmtPct} live={live} commit={commit} />
            <ParamKnob k="noiseLevel" v={val("noiseLevel")} fmt={fmtPct} live={live} commit={commit} />
          </div>
        </section>

        {/* ---- filter (marquee XYPad) ---- */}
        <section className="bl-synth-panel">
          <h3 className="bl-synth-panel-title">Filter</h3>
          <div className="bl-synth-xy">
            <XYPad
              label="Cutoff × Resonance"
              x={{
                value: val("cutoff"),
                min: analogSpec("cutoff")?.min ?? 20,
                max: analogSpec("cutoff")?.max ?? 18000,
                label: "Cutoff",
                unit: "Hz",
                format: fmtFreq,
              }}
              y={{
                value: val("resonance"),
                min: analogSpec("resonance")?.min ?? 0.1,
                max: analogSpec("resonance")?.max ?? 24,
                label: "Reso",
                format: (v) => v.toFixed(1),
              }}
              onChange={(x, y) => {
                live("cutoff", x)
                live("resonance", y)
              }}
              onCommit={(x, y) => commitPair(["cutoff", x], ["resonance", y])}
            />
          </div>
          <div className="bl-synth-row">
            <EnumSelect
              label="Type"
              value={String(params.filterType)}
              options={FILTER_TYPES}
              onChange={(v) => commit("filterType", v)}
            />
          </div>
          <div className="bl-synth-knobs">
            <ParamKnob k="filterEnvAmount" v={val("filterEnvAmount")} fmt={fmtPct} live={live} commit={commit} />
            <ParamKnob k="keyTracking" v={val("keyTracking")} fmt={fmtPct} live={live} commit={commit} />
          </div>
          <Adsr prefix="filter" label="Filter Envelope" val={val} live={live} commit={commit} />
        </section>

        {/* ---- amp ---- */}
        <section className="bl-synth-panel">
          <h3 className="bl-synth-panel-title">Amplifier</h3>
          <Adsr prefix="amp" label="Amp Envelope" val={val} live={live} commit={commit} />
          <div className="bl-synth-knobs">
            <ParamKnob k="drive" v={val("drive")} fmt={fmtPct} live={live} commit={commit} />
            <ParamKnob k="level" v={val("level")} fmt={fmtPct} live={live} commit={commit} />
          </div>
        </section>

        {/* ---- modulation ---- */}
        <section className="bl-synth-panel">
          <h3 className="bl-synth-panel-title">Modulation</h3>
          <div className="bl-synth-knobs">
            <ParamKnob k="lfoRate" v={val("lfoRate")} fmt={(x) => `${x.toFixed(2)}Hz`} live={live} commit={commit} />
            <ParamKnob k="lfoDepth" v={val("lfoDepth")} fmt={fmtPct} live={live} commit={commit} />
            <ParamKnob k="glide" v={val("glide")} fmt={fmtSec} live={live} commit={commit} />
          </div>
          <div className="bl-synth-row">
            <EnumSelect
              label="LFO Target"
              value={String(params.lfoTarget)}
              options={LFO_TARGETS}
              onChange={(v) => commit("lfoTarget", v)}
            />
            <EnumSelect
              label="Voice"
              value={String(params.voiceMode)}
              options={VOICE_MODES}
              onChange={(v) => commit("voiceMode", v)}
            />
          </div>
        </section>
      </div>

      {/* ---- playable keyboard strip ---- */}
      <Keyboard
        onDown={(pitch) => host.previewTrack(track.id, 0.85, pitch)}
      />
    </div>
  )
}

// ----------------------------------------------------------- track bar
const TrackBar = ({
  doc,
  track,
  setTrackId,
}: {
  doc: BeatloungeDoc
  track: Track
  setTrackId: (id: Id) => void
}) => (
  <div className="bl-synth-bar" data-bl-nocapture>
    {doc.tracks
      // MELODIC tracks only — a drum track must never appear as an analog
      // target chip (selecting it + "make analog" would destroy the drums).
      .filter((t) => isMelodicTrack(t))
      .map((t) => (
        <button
          key={t.id}
          type="button"
          className={`bl-chip${t.id === track.id ? " is-on" : ""}`}
          onClick={() => setTrackId(t.id)}
        >
          <span className="bl-dot" style={{ background: t.color ?? "var(--bl-accent)" }} />
          {t.name}
        </button>
      ))}
  </div>
)

// ----------------------------------------------------------- a labelled knob
const ParamKnob = ({
  k,
  v,
  fmt,
  live,
  commit,
}: {
  k: string
  v: number
  fmt: (v: number) => string
  live: (k: string, v: number) => void
  commit: (k: string, v: number) => void
}) => {
  const spec = analogSpec(k)
  if (!spec) return null
  return (
    <Knob
      label={spec.label}
      value={v}
      min={spec.min ?? 0}
      max={spec.max ?? 1}
      step={spec.step}
      defaultValue={typeof spec.default === "number" ? spec.default : undefined}
      format={fmt}
      onChange={(x) => live(k, x)}
      onCommit={(x) => commit(k, x)}
      size={50}
    />
  )
}

// ----------------------------------------------------------- ADSR row
const Adsr = ({
  prefix,
  label,
  val,
  live,
  commit,
}: {
  prefix: "filter" | "amp"
  label: string
  val: (k: string) => number
  live: (k: string, v: number) => void
  commit: (k: string, v: number) => void
}) => {
  const keys = [`${prefix}Attack`, `${prefix}Decay`, `${prefix}Sustain`, `${prefix}Release`]
  return (
    <div className="bl-synth-adsr">
      <span className="bl-synth-section-label">{label}</span>
      <div className="bl-synth-knobs">
        {keys.map((k) => {
          const isSustain = k.endsWith("Sustain")
          return (
            <ParamKnob
              key={k}
              k={k}
              v={val(k)}
              fmt={isSustain ? fmtPct : fmtSec}
              live={live}
              commit={commit}
            />
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------------------------- wave select
const WaveSelect = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) => <EnumSelect label={label} value={value} options={ANALOG_WAVES} onChange={onChange} />

const EnumSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}) => (
  <label className="bl-synth-enum">
    <span className="bl-synth-enum-label">{label}</span>
    <select
      className="bl-synth-enum-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </label>
)
