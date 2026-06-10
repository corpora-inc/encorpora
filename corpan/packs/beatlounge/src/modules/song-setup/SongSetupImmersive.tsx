/**
 * beatlounge — Song Setup IMMERSIVE: the full premium Song surface. Define the
 * piece at the global top level — loop length (up to 128 beats), any time
 * signature (incl. exotic 5/4, 7/8, 9/8 …), long world CYCLES (Indian talas,
 * Balkan aksak, clave), tempo, and swing.
 *
 * Every move dispatches a real command (setLoopLength / setMeter / setTempo /
 * setSwing) — one undo step each. Loading a cycle dispatches meter + loop in a
 * single batch. The per-beat ACCENT MAP is a *visual, local* affordance only:
 * the model has no accent field, so it lives in module state (resets on remount
 * / cycle change). Noted as such; no model change.
 */

import { useEffect, useMemo, useState } from "react"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import type { BeatloungeHost } from "../../contracts/module"
import { Knob } from "../../bl-ui"
import {
  BAR_SNAPS,
  CYCLE_CATALOG,
  MAX_BEATS,
  METER_DENOMINATORS,
  METER_PRESETS,
  barsToTicks,
  beatsPerBar,
  beatsToTicks,
  clampNumerator,
  customCycle,
  findCycle,
  formatMeter,
  maxBeatsForMeter,
  planForCycle,
  ticksToBars,
  ticksToBeats,
  type Cycle,
} from "./songMath"
import type { TimeSignature } from "../../model/timing"

interface Props {
  store: BeatloungeStore
  host?: BeatloungeHost
  cycleId?: string
  onCycle?: (id: string | undefined) => void
}

const defaultSig: TimeSignature = { numerator: 4, denominator: 4 }

export const SongSetupImmersive = ({ store, host, cycleId, onCycle }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const sig = doc.meterMap[0]?.sig ?? defaultSig
  const beats = ticksToBeats(doc.loopLengthTicks, sig)
  const bars = ticksToBars(doc.loopLengthTicks, sig)
  const perBar = beatsPerBar(sig)

  const toast = (msg: string) => host?.toast(msg)

  // -------------------------------------------------------- accent map (local)
  // Visual-only: the model has no accent field. Seeded from a loaded cycle.
  const [accents, setAccents] = useState<Set<number>>(new Set([0]))
  useEffect(() => {
    const c = cycleId ? findCycle(cycleId) : undefined
    setAccents(new Set(c ? c.accents : [0]))
    // re-seed whenever the loaded cycle changes
  }, [cycleId])

  // -------------------------------------------------------- dispatch helpers
  const setLoopTicks = (ticks: number) => {
    store.dispatch({ t: "setLoopLength", ticks })
  }
  const setMeter = (next: TimeSignature) => {
    store.dispatch({ t: "setMeter", tick: 0, sig: next })
    onCycle?.(undefined)
  }
  const loadCycle = (c: Cycle) => {
    const plan = planForCycle(c)
    store.dispatch({
      t: "batch",
      label: `Load ${c.name}`,
      commands: [
        { t: "setMeter", tick: 0, sig: plan.sig },
        { t: "setLoopLength", ticks: plan.loopTicks },
      ],
    })
    onCycle?.(c.id === "custom" ? undefined : c.id)
    setAccents(new Set(plan.accents))
    toast(`${c.name} · ${plan.beats} beats · ${formatMeter(plan.sig)}`)
  }

  // -------------------------------------------------------- loop editing
  const maxBeats = Math.min(MAX_BEATS, maxBeatsForMeter(sig))
  const setBeats = (n: number) => {
    const b = Math.max(1, Math.min(maxBeats, Math.round(n)))
    setLoopTicks(beatsToTicks(b, sig))
    onCycle?.(undefined)
  }
  const setBars = (n: number) => {
    const b = Math.max(1, Math.round(n))
    setLoopTicks(barsToTicks(b, sig))
    onCycle?.(undefined)
  }

  // -------------------------------------------------------- meter editing
  const setNumerator = (n: number) => setMeter({ ...sig, numerator: clampNumerator(n) })
  const setDenominator = (d: number) =>
    setMeter({ ...sig, denominator: d as TimeSignature["denominator"] })

  const activeCycle = useMemo(
    () =>
      CYCLE_CATALOG.find(
        (c) => c.id === cycleId && c.beats === beats && formatMeter(c.sig) === formatMeter(sig)
      ),
    [cycleId, beats, sig]
  )

  const [customBeats, setCustomBeats] = useState(7)

  const toggleAccent = (i: number) =>
    setAccents((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className="bl-song">
      {/* -------- summary header -------- */}
      <div className="bl-song-summary">
        <span className="bl-song-summary-big">{beats}</span>
        <span className="bl-song-summary-unit">beats</span>
        <span className="bl-song-summary-sep">·</span>
        <span className="bl-song-summary-meter">{formatMeter(sig)}</span>
        <span className="bl-song-summary-sep">·</span>
        <span className="bl-song-summary-bpm">{Math.round(doc.bpm)} bpm</span>
        {activeCycle && <span className="bl-song-summary-tag">{activeCycle.name}</span>}
      </div>

      <div className="bl-song-cols">
        {/* ============================ LOOP LENGTH ============================ */}
        <section className="bl-song-section">
          <h3 className="bl-song-h">Loop length</h3>
          <div className="bl-song-readrow">
            <span className="bl-song-read">
              {beats} <em>beats</em>
            </span>
            <span className="bl-song-read">
              {bars}
              {perBar && beats % perBar !== 0 ? "+" : ""} <em>bars</em>
            </span>
            <span className="bl-song-read bl-song-read-dim">{doc.loopLengthTicks} ticks</span>
          </div>

          <label className="bl-song-fieldlabel" htmlFor="bl-song-beats">
            Beats (1–{maxBeats})
          </label>
          <div className="bl-song-stepper">
            <button className="bl-chip" onClick={() => setBeats(beats - 1)} aria-label="One fewer beat">
              −
            </button>
            <input
              id="bl-song-beats"
              className="bl-song-numinput"
              type="number"
              min={1}
              max={maxBeats}
              value={beats}
              onChange={(e) => setBeats(Number(e.target.value))}
            />
            <button className="bl-chip" onClick={() => setBeats(beats + 1)} aria-label="One more beat">
              +
            </button>
          </div>
          <input
            className="bl-song-range"
            type="range"
            min={1}
            max={maxBeats}
            value={beats}
            aria-label="Loop length in beats"
            onChange={(e) => setBeats(Number(e.target.value))}
          />

          <div className="bl-song-snaplabel">Snap to bars</div>
          <div className="bl-song-chips">
            {BAR_SNAPS.map((n) => (
              <button
                key={n}
                className={"bl-chip" + (bars === n && beats % perBar === 0 ? " is-on" : "")}
                onClick={() => setBars(n)}
              >
                {n} {n === 1 ? "bar" : "bars"}
              </button>
            ))}
          </div>
        </section>

        {/* ============================ TIME SIGNATURE ============================ */}
        <section className="bl-song-section">
          <h3 className="bl-song-h">Time signature</h3>
          <div className="bl-song-meter">
            <div className="bl-song-stepper">
              <button
                className="bl-chip"
                onClick={() => setNumerator(sig.numerator - 1)}
                aria-label="Fewer beats per bar"
              >
                −
              </button>
              <input
                className="bl-song-numinput bl-song-numinput-lg"
                type="number"
                min={1}
                max={32}
                value={sig.numerator}
                aria-label="Beats per bar (numerator)"
                onChange={(e) => setNumerator(Number(e.target.value))}
              />
              <button
                className="bl-chip"
                onClick={() => setNumerator(sig.numerator + 1)}
                aria-label="More beats per bar"
              >
                +
              </button>
            </div>
            <span className="bl-song-meter-slash">/</span>
            <div className="bl-song-denoms">
              {METER_DENOMINATORS.map((d) => (
                <button
                  key={d}
                  className={"bl-chip" + (sig.denominator === d ? " is-on" : "")}
                  onClick={() => setDenominator(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="bl-song-snaplabel">Presets</div>
          <div className="bl-song-chips">
            {METER_PRESETS.map((p) => (
              <button
                key={p.label}
                className={
                  "bl-chip bl-song-preset" +
                  (formatMeter(p.sig) === formatMeter(sig) ? " is-on" : "")
                }
                title={p.feel}
                onClick={() => setMeter(p.sig)}
              >
                <span className="bl-song-preset-sig">{p.label}</span>
                <span className="bl-song-preset-feel">{p.feel}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ============================ TEMPO + SWING ============================ */}
        <section className="bl-song-section bl-song-section-knobs">
          <h3 className="bl-song-h">Tempo &amp; swing</h3>
          <div className="bl-song-knobrow">
            <Knob
              label="Tempo"
              unit=""
              value={doc.bpm}
              min={20}
              max={300}
              step={1}
              defaultValue={96}
              size={84}
              format={(v) => String(Math.round(v))}
              onChange={(v) => store.dispatch({ t: "setTempo", bpm: Math.round(v) })}
            />
            <div className="bl-song-bpmfield">
              <input
                className="bl-song-numinput"
                type="number"
                min={20}
                max={300}
                value={Math.round(doc.bpm)}
                aria-label="Tempo in BPM"
                onChange={(e) =>
                  store.dispatch({ t: "setTempo", bpm: Math.round(Number(e.target.value)) })
                }
              />
              <span className="bl-song-fieldlabel">BPM</span>
            </div>
            <Knob
              label="Swing"
              value={doc.swing.amount}
              min={0}
              max={0.66}
              step={0.01}
              defaultValue={0}
              size={84}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => store.dispatch({ t: "setSwing", amount: v })}
            />
          </div>
          <div className="bl-song-snaplabel">Swing grid</div>
          <div className="bl-song-chips">
            {([8, 16] as const).map((d) => (
              <button
                key={d}
                className={"bl-chip" + (doc.swing.grid.denominator === d ? " is-on" : "")}
                onClick={() =>
                  store.dispatch({
                    t: "setSwing",
                    amount: doc.swing.amount,
                    grid: { denominator: d },
                  })
                }
              >
                1/{d}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ============================ CYCLES (TALAS) ============================ */}
      <section className="bl-song-section bl-song-cycles">
        <h3 className="bl-song-h">
          Cycles <span className="bl-song-h-sub">world rhythms · talas</span>
        </h3>
        <div className="bl-song-cyclegrid">
          {CYCLE_CATALOG.map((c) => {
            const on = activeCycle?.id === c.id
            return (
              <button
                key={c.id}
                className={"bl-song-cycle" + (on ? " is-on" : "")}
                onClick={() => loadCycle(c)}
              >
                <span className="bl-song-cycle-top">
                  <span className="bl-song-cycle-name">{c.name}</span>
                  <span className="bl-song-cycle-beats">{c.beats}</span>
                </span>
                <span className="bl-song-cycle-trad">{c.tradition}</span>
                {c.vibhags && (
                  <span className="bl-song-cycle-groups">{c.vibhags.join(" · ")}</span>
                )}
                <span className="bl-song-cycle-blurb">{c.blurb}</span>
              </button>
            )
          })}

          {/* custom N-beat cycle */}
          <div className="bl-song-cycle bl-song-cycle-custom">
            <span className="bl-song-cycle-top">
              <span className="bl-song-cycle-name">Custom</span>
              <span className="bl-song-cycle-beats">{customBeats}</span>
            </span>
            <span className="bl-song-cycle-trad">your own cycle</span>
            <input
              className="bl-song-range"
              type="range"
              min={1}
              max={MAX_BEATS}
              value={customBeats}
              aria-label="Custom cycle beats"
              onChange={(e) => setCustomBeats(Number(e.target.value))}
            />
            <button
              className="bl-chip is-on bl-song-cycle-go"
              onClick={() => loadCycle(customCycle(customBeats))}
            >
              Set {customBeats}-beat cycle
            </button>
          </div>
        </div>
      </section>

      {/* ============================ ACCENT MAP (visual, local) ============================ */}
      <section className="bl-song-section bl-song-accents">
        <h3 className="bl-song-h">
          Accent map <span className="bl-song-h-sub">tap a beat to mark the sam / strong beats</span>
        </h3>
        <div className="bl-song-accentrow">
          {Array.from({ length: Math.min(beats, MAX_BEATS) }, (_, i) => {
            const isBarStart = perBar > 0 && i % perBar === 0
            return (
              <button
                key={i}
                className={
                  "bl-song-accent" +
                  (accents.has(i) ? " is-accent" : "") +
                  (isBarStart ? " is-barstart" : "")
                }
                aria-label={`Beat ${i + 1}${accents.has(i) ? ", accented" : ""}`}
                aria-pressed={accents.has(i)}
                onClick={() => toggleAccent(i)}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        <p className="bl-song-note">
          Accents are a visual guide for now (the song model has no accent field yet).
        </p>
      </section>
    </div>
  )
}
