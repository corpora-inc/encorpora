/**
 * beatlounge — phrase-SCRATCH master FX panel: the FULL effect rack, rendered in
 * the SHARED bottom drawer (the same surface Drums / Instruments use).
 *
 * This is the scratch master rack — a FIXED curated chain (Filter, Delay, Reverb,
 * Crush) that colours BOTH decks at once (decks → bus → destination). Unlike the
 * doc-backed `TrackFxChain`, the scratch chain is a LIVE bus with NO document
 * track (scratch is a hand-driven performance, no undo history), so it can't be
 * driven through `store.dispatch` / `host.applyParam`. Instead it renders the
 * SHARED fx-rack effect-CARD look — the exact `.bl-fxchain` / `.bl-fxcard` /
 * `.bl-fxcard-power` / `.bl-fxcard-xy` classes the mixer rack uses — and drives
 * the live `ScratchFxBus` directly so the cards match every other screen's rack.
 *
 * Realtime wiring mirrors the fx-rack: as a knob/pad MOVES we drive the live node
 * through `bus.liveParam` (no state churn); on RELEASE we commit ONE local-state
 * edit (`onSetParams`) so the dial settles on the true value. Toggling bypass
 * commits immediately. It reuses the SHARED `EFFECT_SPECS` + `Knob`/`XYPad`, so a
 * knob here drives the EXACT Tone node the mixer would.
 */

import { useState } from "react"
import type { EffectNode } from "../../model/document"
import { EFFECT_SPECS, numParam, type EffectParamSpec } from "../../effects/params"
import { Knob, XYPad } from "../../bl-ui"
import type { ScratchFxBus } from "./scratchFxBus"

interface Props {
  chain: EffectNode[]
  bus: ScratchFxBus | null
  onToggle: (id: string) => void
  onSetParams: (id: string, params: Record<string, number>) => void
}

/** The scratch master rack as the shared effect-card chain (no popover chrome —
 *  the drawer owns the title + close). */
export const ScratchFxPanel = ({ chain, bus, onToggle, onSetParams }: Props) => (
  <div className="bl-fxchain bl-scrfx-chain">
    <div className="bl-fxchain-bar" data-bl-nocapture>
      <span className="bl-fxchain-count">
        {chain.length} effect{chain.length === 1 ? "" : "s"} · master
      </span>
    </div>
    <div className="bl-scrfx-cards">
      {chain.map((fx) => (
        <ScratchEffectCard
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

const ScratchEffectCard = ({
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
    <div className={`bl-fxcard${fx.enabled ? "" : " is-bypassed"}`} data-bl-nocapture>
      <div className="bl-fxcard-head">
        <button
          type="button"
          className={`bl-fxcard-power${fx.enabled ? " is-on" : ""}`}
          aria-pressed={fx.enabled}
          aria-label={fx.enabled ? "Bypass effect" : "Enable effect"}
          title={fx.enabled ? "Bypass" : "Engage"}
          onClick={onToggle}
        />
        <span className="bl-fxcard-name">{spec.label}</span>
      </div>

      {fx.kind === "filter" && (
        <FilterPad fx={fx} onLive={live} onCommit={onSetParams} />
      )}

      <div className="bl-fxcard-params">
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
      size={50}
    />
  )
}
