/**
 * beatlounge — the BACKING-AGNOSTIC FX-chain pipeline view.
 *
 * This is the canonical effects rack UI — the add-effect menu over the full
 * palette, the insert LIST (each a card: power toggle + params + Filter XY pad +
 * delay note-length presets), REMOVE, REORDER (move up/down). It is purely
 * presentational: it owns NO write path and makes NO assumption about WHERE the
 * chain lives. The caller supplies the chain + a set of callbacks, so the SAME
 * rack renders over:
 *   • a doc-backed track (`TrackFxChain` → store commands + undo), and
 *   • the live scratch master bus (`PhraseScratchImmersive` → ScratchFxBus, no
 *     doc / no undo — a hand-driven performance).
 *
 * CRITICAL — the REALTIME param wiring is preserved verbatim: as a knob/XY pad
 * MOVES we drive the live audio node through `onParamLive` (no commit, no undo
 * step) so the sound sweeps under the finger; on RELEASE we `onParamCommit` ONE
 * final value (one undo step on the doc path). Do not regress this — it is what
 * makes filter cutoff / resonance / delay time sweep smoothly.
 *
 * Sends are doc-only (they target buses, an arrangement concept) — the caller
 * renders them via the `sends` slot; this view never assumes they exist.
 */

import { useState, type ReactNode } from "react"
import type { EffectNode } from "../../model/document"
import { Knob, XYPad } from "../../bl-ui"
import {
  EFFECT_KINDS,
  EFFECT_SPECS,
  numParam,
  strParam,
  type EffectParamSpec,
  type EffectSpec,
} from "../../effects/params"
import {
  NOTE_LENGTH_PRESETS,
  noteLengthSeconds,
  closestNoteLengthId,
  exceedsMaxDelay,
  MAX_DELAY_SECONDS,
} from "../../effects/noteLengths"

/** Form factor — drives the phone quick-add shortcut. */
export type FxForm = "phone" | "tablet" | "desktop"

export interface FxChainCallbacks {
  /** Add a default-config insert of `kind` (appended unless the caller inserts). */
  onAdd: (kind: (typeof EFFECT_KINDS)[number]) => void
  /** Remove the insert with `id`. */
  onRemove: (id: string) => void
  /** Move the insert `dir` places in the chain (−1 up, +1 down). */
  onMove: (id: string, dir: -1 | 1) => void
  /** Flip the insert's bypass. */
  onToggle: (id: string) => void
  /** Per-move: drive ONE param of the live node (no commit / no undo). */
  onParamLive: (id: string, param: string, value: number) => void
  /** On release: commit one-or-more params on an insert (one undo step on doc). */
  onParamCommit: (id: string, params: Record<string, number | string>) => void
}

interface Props extends FxChainCallbacks {
  /** The chain to render, in order. */
  effects: EffectNode[]
  /** Song tempo — drives the delay note-length presets. */
  bpm: number
  /** Form factor (phone gets a one-tap default add). */
  form: FxForm
  /** Optional header (count + a Clear affordance) — the doc path supplies it. */
  header?: ReactNode
  /** Optional sends slot, rendered under the chain (doc-only). */
  sends?: ReactNode
  /**
   * Optional phone quick-add: on phone the "+ Add effect" button calls this for a
   * one-tap default insert instead of opening the long palette menu. When absent,
   * the menu always opens. (Doc path wires it; scratch leaves it off.)
   */
  onQuickAdd?: () => void
}

export const FxChainView = ({
  effects,
  bpm,
  header,
  sends,
  onAdd,
  onRemove,
  onMove,
  onToggle,
  onParamLive,
  onParamCommit,
}: Props) => {
  const [adding, setAdding] = useState(false)

  const add = (kind: (typeof EFFECT_KINDS)[number]) => {
    onAdd(kind)
    setAdding(false)
  }

  return (
    <div className="bl-fxchain">
      {header}

      <div className="bl-fxrack-chain">
        {effects.map((fx, i) => (
          <EffectCard
            key={fx.id}
            fx={fx}
            index={i}
            count={effects.length}
            bpm={bpm}
            onRemove={onRemove}
            onMove={onMove}
            onToggle={onToggle}
            onParamLive={onParamLive}
            onParamCommit={onParamCommit}
          />
        ))}

        <div className="bl-fxrack-add" data-bl-nocapture>
          {adding ? (
            <div className="bl-fxrack-menu" role="menu">
              {EFFECT_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="bl-chip"
                  role="menuitem"
                  onClick={() => add(kind)}
                >
                  {EFFECT_SPECS[kind].label}
                </button>
              ))}
              <button
                type="button"
                className="bl-chip"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="bl-fxrack-addbtn"
              onClick={() => setAdding(true)}
            >
              + Add effect
            </button>
          )}
        </div>
      </div>

      {sends}
    </div>
  )
}

// ----------------------------------------------------------- effect card
interface CardProps {
  fx: EffectNode
  index: number
  count: number
  bpm: number
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onToggle: (id: string) => void
  onParamLive: (id: string, param: string, value: number) => void
  onParamCommit: (id: string, params: Record<string, number | string>) => void
}

const EffectCard = ({
  fx,
  index,
  count,
  bpm,
  onRemove,
  onMove,
  onToggle,
  onParamLive,
  onParamCommit,
}: CardProps) => {
  const spec = EFFECT_SPECS[fx.kind]
  const timeSpec = spec.params.find((p) => p.key === "delayTime")
  // Only the DELAY's delayTime is a beat-synced echo time. Chorus also has a
  // `delayTime` (a 1–20ms modulation delay) — that is NOT a note length, so the
  // preset row is delay-only.
  const showNoteLengths = fx.kind === "delay" && !!timeSpec

  const setParam = (key: string, value: number | string) =>
    onParamCommit(fx.id, { [key]: value })
  const liveParam = (key: string, value: number) => onParamLive(fx.id, key, value)
  const setParams = (params: Record<string, number | string>) =>
    onParamCommit(fx.id, params)

  return (
    <div className={`bl-fxcard${fx.enabled ? "" : " is-bypassed"}`}>
      <div className="bl-fxcard-head" data-bl-nocapture>
        <button
          type="button"
          className={`bl-fxcard-power${fx.enabled ? " is-on" : ""}`}
          aria-pressed={fx.enabled}
          aria-label={fx.enabled ? "Bypass effect" : "Enable effect"}
          title={fx.enabled ? "Bypass" : "Enable"}
          onClick={() => onToggle(fx.id)}
        />
        <span className="bl-fxcard-name">{spec.label}</span>
        <div className="bl-fxcard-actions">
          <button
            type="button"
            className="bl-iconbtn"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(fx.id, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="bl-iconbtn"
            aria-label="Move down"
            disabled={index === count - 1}
            onClick={() => onMove(fx.id, 1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="bl-iconbtn is-danger"
            aria-label="Remove effect"
            onClick={() => onRemove(fx.id)}
          >
            ✕
          </button>
        </div>
      </div>

      {showNoteLengths && timeSpec && (
        <NoteLengthRow
          bpm={bpm}
          seconds={numParam(fx.params, timeSpec)}
          maxSeconds={timeSpec.max ?? MAX_DELAY_SECONDS}
          onPick={(fraction) =>
            setParam(
              "delayTime",
              Math.min(timeSpec.max ?? MAX_DELAY_SECONDS, noteLengthSeconds(fraction, bpm))
            )
          }
        />
      )}

      {fx.kind === "filter" && (
        <FilterPad fx={fx} spec={spec} onLive={liveParam} onCommit={setParams} />
      )}

      <div className="bl-fxcard-params" data-bl-nocapture>
        {spec.params.map((p) =>
          p.type === "enum" ? (
            <EnumParam key={p.key} spec={p} fx={fx} onChange={(v) => setParam(p.key, v)} />
          ) : (
            <ParamKnob
              key={p.key}
              spec={p}
              fx={fx}
              onLive={(v) => liveParam(p.key, v)}
              onCommit={(v) => setParam(p.key, v)}
            />
          )
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------- delay note-length presets
/**
 * Tempo-synced note-length quick-set chips for the delay card: tap 1/4 · 1/4· ·
 * 1/8 · 1/8T · 1/16 to lock `delayTime` (seconds) to that note value at the song
 * BPM. The currently-matching preset highlights; the free seconds knob below
 * stays for fine control.
 */
const NoteLengthRow = ({
  bpm,
  seconds,
  maxSeconds,
  onPick,
}: {
  bpm: number
  seconds: number
  /** The delay's maxDelay; longer note lengths are dimmed at slow tempos. */
  maxSeconds: number
  onPick: (fraction: number) => void
}) => {
  const active = closestNoteLengthId(seconds, bpm)
  return (
    <div className="bl-fxsync" data-bl-nocapture>
      <span className="bl-fxsync-label">Sync</span>
      <div className="bl-fxsync-chips">
        {NOTE_LENGTH_PRESETS.map((p) => {
          const over = exceedsMaxDelay(p.fraction, bpm, maxSeconds)
          return (
            <button
              key={p.id}
              type="button"
              className={`bl-fxsync-chip${active === p.id ? " is-on" : ""}${over ? " is-over" : ""}`}
              onClick={() => onPick(p.fraction)}
              disabled={over}
              aria-pressed={active === p.id}
              title={over ? "Too long at this tempo" : undefined}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------------------------- filter XY pad
/**
 * The Filter card's X/Y control surface: X = cutoff frequency, Y = resonance
 * (Q). It complements the knobs — drag the puck to sweep both at once. As the
 * finger MOVES we drive the audio node in REAL TIME via `onLive`; we also hold
 * the live values locally so the puck tracks the finger. On RELEASE we commit
 * ONE edit with the SAME final values, so there is no jump on release.
 */
const FilterPad = ({
  fx,
  spec,
  onLive,
  onCommit,
}: {
  fx: EffectNode
  spec: EffectSpec
  onLive: (key: string, value: number) => void
  onCommit: (params: Record<string, number>) => void
}) => {
  const freqSpec = spec.params.find((p) => p.key === "frequency")
  const qSpec = spec.params.find((p) => p.key === "q")
  const [live, setLive] = useState<{ x: number; y: number } | null>(null)
  if (!freqSpec || !qSpec) return null

  const freqVal = live?.x ?? numParam(fx.params, freqSpec)
  const qVal = live?.y ?? numParam(fx.params, qSpec)

  const fmtFreq = (v: number): string =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)

  return (
    <div className="bl-fxcard-xy">
      <XYPad
        label="Cutoff × Resonance"
        x={{
          value: freqVal,
          min: freqSpec.min ?? 20,
          max: freqSpec.max ?? 18000,
          label: "Cutoff",
          unit: "Hz",
          format: fmtFreq,
        }}
        y={{
          value: qVal,
          min: qSpec.min ?? 0.1,
          max: qSpec.max ?? 20,
          label: "Q",
          format: (v) => v.toFixed(1),
        }}
        onChange={(fx2, q2) => {
          setLive({ x: fx2, y: q2 })
          onLive("frequency", fx2)
          onLive("q", q2)
        }}
        onCommit={(fx2, q2) => {
          setLive(null)
          onCommit({ frequency: fx2, q: q2 })
        }}
      />
    </div>
  )
}

// ----------------------------------------------------------- param controls
const ParamKnob = ({
  spec,
  fx,
  onLive,
  onCommit,
}: {
  spec: EffectParamSpec
  fx: EffectNode
  onLive: (v: number) => void
  onCommit: (v: number) => void
}) => {
  const docValue = numParam(fx.params, spec)
  const [live, setLive] = useState<number | null>(null)
  const value = live ?? docValue
  const fmt = (v: number): string => {
    if (spec.unit === "Hz") return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
    if (spec.unit === "dB") return v.toFixed(1)
    if (spec.unit === "s") return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`
    if (spec.min === 0 && spec.max === 1) return `${Math.round(v * 100)}`
    return v.toFixed(spec.step && spec.step < 1 ? 2 : 0)
  }
  return (
    <Knob
      label={spec.label}
      value={value}
      min={spec.min ?? 0}
      max={spec.max ?? 1}
      step={spec.step}
      defaultValue={spec.default as number}
      unit={spec.unit && spec.unit !== "Hz" && spec.unit !== "dB" && spec.unit !== "s" ? spec.unit : undefined}
      format={fmt}
      onChange={(v) => {
        setLive(v)
        onLive(v)
      }}
      onCommit={(v) => {
        setLive(null)
        onCommit(v)
      }}
      size={50}
    />
  )
}

const EnumParam = ({
  spec,
  fx,
  onChange,
}: {
  spec: EffectParamSpec
  fx: EffectNode
  onChange: (v: string) => void
}) => {
  const value = strParam(fx.params, spec)
  return (
    <label className="bl-fxenum">
      <span className="bl-fxenum-label">{spec.label}</span>
      <select
        className="bl-fxenum-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {(spec.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}
