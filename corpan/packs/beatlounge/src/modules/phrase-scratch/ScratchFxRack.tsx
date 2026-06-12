/**
 * beatlounge — phrase-SCRATCH master FX rack (the popup).
 *
 * A small, premium popover that controls the OPTIONAL effect chain on the scratch
 * MASTER output (both decks at once). It is a FIXED curated rack — Filter, Delay,
 * Reverb, Crush — each with a power toggle + its key knobs (the Filter gets the
 * same Cutoff×Resonance XY pad as the mixer). It reuses the SHARED `EFFECT_SPECS`
 * + `Knob`/`XYPad`, so a knob here drives the EXACT Tone node the mixer would.
 *
 * Realtime wiring mirrors the fx-rack: as a knob/pad MOVES we drive the live node
 * through `bus.liveParam` (no state churn); on RELEASE we commit ONE state edit
 * (`onSetParams`) so the dial settles on the true value. Toggling bypass commits
 * immediately. No store, no undo — scratch is a live performance.
 */

import { useState } from "react"
import type { EffectNode } from "../../model/document"
import { EFFECT_SPECS, numParam, type EffectParamSpec } from "../../effects/params"
import { Knob, XYPad, Glyph } from "../../bl-ui"
import type { ScratchFxBus } from "./scratchFxBus"

interface Props {
  chain: EffectNode[]
  bus: ScratchFxBus | null
  onToggle: (id: string) => void
  onSetParams: (id: string, params: Record<string, number>) => void
  onClose: () => void
}

export const ScratchFxRack = ({ chain, bus, onToggle, onSetParams, onClose }: Props) => (
  <div className="bl-scrfx" role="dialog" aria-label="Scratch effects" data-bl-nocapture>
    <div className="bl-scrfx-head">
      <span className="bl-scrfx-title">Effects</span>
      <button
        type="button"
        className="bl-scrfx-close"
        onClick={onClose}
        aria-label="Close effects"
      >
        <Glyph name="chevron-down" size={16} />
      </button>
    </div>
    <div className="bl-scrfx-body">
      {chain.map((fx) => (
        <InsertCard
          key={fx.id}
          fx={fx}
          bus={bus}
          onToggle={() => onToggle(fx.id)}
          onSetParams={(p) => onSetParams(fx.id, p)}
        />
      ))}
    </div>
  </div>
)

const InsertCard = ({
  fx,
  bus,
  onToggle,
  onSetParams,
}: {
  fx: EffectNode
  bus: ScratchFxBus | null
  onToggle: () => void
  onSetParams: (params: Record<string, number>) => void
}) => {
  const spec = EFFECT_SPECS[fx.kind]
  const live = (param: string, value: number) => bus?.liveParam(fx.id, param, value)

  return (
    <div className={`bl-scrfx-card${fx.enabled ? " is-on" : ""}`}>
      <button
        type="button"
        className="bl-scrfx-card-head"
        onClick={onToggle}
        aria-pressed={fx.enabled}
        title={fx.enabled ? "Bypass" : "Engage"}
      >
        <span className={`bl-scrfx-power${fx.enabled ? " is-on" : ""}`} />
        <span className="bl-scrfx-name">{spec.label}</span>
      </button>

      {fx.kind === "filter" ? (
        <FilterPad fx={fx} onLive={live} onCommit={onSetParams} />
      ) : (
        <div className="bl-scrfx-knobs">
          {spec.params
            .filter((p) => p.type === "number")
            .map((p) => (
              <ParamKnob
                key={p.key}
                spec={p}
                fx={fx}
                onLive={(v) => live(p.key, v)}
                onCommit={(v) => onSetParams({ [p.key]: v })}
              />
            ))}
        </div>
      )}
    </div>
  )
}

const fmtFreq = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))

const FilterPad = ({
  fx,
  onLive,
  onCommit,
}: {
  fx: EffectNode
  onLive: (param: string, value: number) => void
  onCommit: (params: Record<string, number>) => void
}) => {
  const spec = EFFECT_SPECS.filter
  const freqSpec = spec.params.find((p) => p.key === "frequency")
  const qSpec = spec.params.find((p) => p.key === "q")
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  if (!freqSpec || !qSpec) return null
  const freqVal = drag?.x ?? numParam(fx.params, freqSpec)
  const qVal = drag?.y ?? numParam(fx.params, qSpec)
  return (
    <div className="bl-scrfx-xy">
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
        onChange={(f, q) => {
          setDrag({ x: f, y: q })
          onLive("frequency", f)
          onLive("q", q)
        }}
        onCommit={(f, q) => {
          setDrag(null)
          onCommit({ frequency: f, q })
        }}
      />
    </div>
  )
}

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
  const [drag, setDrag] = useState<number | null>(null)
  const value = drag ?? docValue
  const fmt = (v: number): string => {
    if (spec.unit === "Hz") return fmtFreq(v)
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
      format={fmt}
      onChange={(v) => {
        setDrag(v)
        onLive(v)
      }}
      onCommit={(v) => {
        setDrag(null)
        onCommit(v)
      }}
      size={46}
    />
  )
}
