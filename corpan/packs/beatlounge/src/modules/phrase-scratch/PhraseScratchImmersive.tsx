/**
 * beatlounge — the phrase-SCRATCH IMMERSIVE view: isolate ONE saved snippet and
 * scratch it like a record. The headline widget.
 *
 *   • PLATTER — a big vinyl the user drags. Each animation frame we convert the
 *     finger's recent angular VELOCITY into a turntable playbackRate (sign =
 *     direction: drag backwards → the phrase plays in reverse) and feed it to the
 *     ScratchEngine. A held finger ⇒ rate eases toward the baseline (0 = hold,
 *     or 1 = spin) so a release coasts instead of snapping.
 *   • SPIN/HOLD — parks the baseline at 0 (a held record) or 1 (the phrase loops
 *     normally), so you can start it spinning then scratch over the top.
 *   • PITCH — an independent detune (granular decoupling) ±12 semitones.
 *   • PICKER — choose which bank snippet is loaded onto the turntable.
 *
 * The engine plays DIRECTLY on the shared AudioContext (a live instrument, not
 * the transport). Continuity is by construction: the looped GrainPlayer never
 * re-triggers, so moving the rate (even through zero / into reverse) is gapless —
 * no skips, no clicks. We dispose the engine + RAF on unmount / snippet change.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import type { FragmentRef } from "../../model/document"
import { bankSnippets } from "../../phrase/bank"
import type { AudioSource } from "../../phrase/audioSource"
import { decodeFragmentBytes } from "../../phrase/decode"
import { Glyph, prefersReducedMotion } from "../../bl-ui"
import { ensureAudio } from "../../engine/ensureAudio"
import { createScratchEngine, type ScratchEngine } from "./scratchEngine"
import {
  advanceRotation,
  angularVelocityToRate,
  easeRate,
  fmtRate,
  isHeld,
} from "./scratchMath"
import { Platter } from "./Platter"

const LOG = "[beatlounge/phrase-scratch]"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
}

/** How quickly the live rate eases toward the finger / baseline (seconds). */
const FOLLOW_TAU = 0.04
const COAST_TAU = 0.22

/** A snippet's stable identity for picker selection + dedup. */
const refKey = (r: FragmentRef): string => `${r.language ?? ""}:${r.text ?? ""}:${r.voiceId ?? ""}`

export const PhraseScratchImmersive = ({ host, store, audioSource }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const bank = bankSnippets(doc)
  const reduced = prefersReducedMotion()

  // Which snippet is on the turntable (default: newest saved).
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = useMemo<FragmentRef | null>(() => {
    if (bank.length === 0) return null
    if (selectedKey) {
      const found = bank.find((r) => refKey(r) === selectedKey)
      if (found) return found
    }
    return bank[bank.length - 1] ?? null
  }, [bank, selectedKey])

  const [loading, setLoading] = useState(false)
  const [spinning, setSpinning] = useState(false) // baseline 1 vs 0 (hold)
  const [pitch, setPitch] = useState(0)
  const [active, setActive] = useState(false) // a finger is on the platter
  const [rateDisplay, setRateDisplay] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Live engine + animation state live in refs (no re-render churn per frame).
  const engineRef = useRef<ScratchEngine | null>(null)
  const baselineRef = useRef(0) // 0 = hold, 1 = spin
  const liveRateRef = useRef(0) // the rate currently driving the engine
  const targetRef = useRef(0) // finger-driven target (overrides baseline while held)
  const grabbedRef = useRef(false) // a finger owns the platter
  // Recent angular velocity from the platter sweep (radians/sec), low-passed.
  const angVelRef = useRef(0)
  const rotRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)

  baselineRef.current = spinning ? 1 : 0

  // ---- load the selected snippet onto the turntable -------------------------
  useEffect(() => {
    let cancelled = false
    // Tear down any prior engine before loading the next snippet.
    engineRef.current?.dispose()
    engineRef.current = null
    liveRateRef.current = 0
    targetRef.current = 0
    angVelRef.current = 0
    setRateDisplay(0)

    if (!selected || !selected.text || !selected.language) {
      setLoading(false)
      return
    }

    const ref = selected
    setLoading(true)
    void (async () => {
      try {
        const ctx = host.audioContext()
        // NB: do NOT resume the context here — this effect runs on mount /
        // snippet change, NOT a user gesture, so an off-gesture resume() fails
        // silently and spams the "AudioContext was not allowed to start"
        // warning. Resuming happens from `onGrab` (a real pointer gesture).
        // Prefer cached bytes; resolve fresh (renders + caches) if absent.
        let bytes = ref.sha256 ? await audioSource.getCachedAudio(ref.sha256) : null
        if (!bytes) {
          const resolved = await audioSource.resolveFragmentAudio(
            ref.text!,
            ref.language!,
            ref.voiceId
          )
          if (resolved.audio && resolved.audio.bytes.byteLength > 0) {
            bytes = resolved.audio
          }
        }
        if (cancelled) return
        if (!bytes) {
          console.warn(`${LOG} no audio bytes for snippet (synth-vox floor):`, ref.text)
          host.toast("That snippet has no audio yet — open Phrases to render it")
          setLoading(false)
          return
        }
        const buffer = await decodeFragmentBytes(ctx, bytes)
        if (cancelled) return
        if (!buffer) {
          host.toast("Couldn't decode that snippet")
          setLoading(false)
          return
        }
        const engine = createScratchEngine(ctx, buffer, {
          baselineRate: baselineRef.current,
          gain: 0.95,
        })
        engine.setPitch(pitch)
        engineRef.current = engine
        liveRateRef.current = baselineRef.current
        setLoading(false)
      } catch (err) {
        console.warn(`${LOG} load failed:`, err)
        if (!cancelled) {
          host.toast("Couldn't load that snippet")
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // pitch intentionally excluded: pitch changes are applied live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, host, audioSource])

  // Apply pitch live without reloading.
  useEffect(() => {
    engineRef.current?.setPitch(pitch)
  }, [pitch])

  // ---- the RAF loop: ease the live rate, drive the engine + rotation --------
  useEffect(() => {
    const tick = (ts: number) => {
      const last = lastTsRef.current
      const dt = last == null ? 1 / 60 : Math.min(0.05, (ts - last) / 1000)
      lastTsRef.current = ts

      // Decide the target rate this frame.
      let target: number
      if (grabbedRef.current) {
        // Finger owns it: rate ∝ recent angular velocity of the sweep.
        target = angularVelocityToRate(angVelRef.current)
        // Decay the stored velocity so a stalled-but-held finger settles to hold.
        angVelRef.current *= Math.exp(-dt / 0.08)
      } else {
        // Released: coast toward the baseline (spin or hold).
        target = baselineRef.current
      }

      const tau = grabbedRef.current ? FOLLOW_TAU : COAST_TAU
      const next = easeRate(liveRateRef.current, target, dt, tau)
      liveRateRef.current = next
      engineRef.current?.setRate(next)

      // Advance the visual rotation by the live rate (disc tracks the audio).
      rotRef.current = advanceRotation(rotRef.current, next, dt)

      // Throttle React state to ~every frame but only when it meaningfully moved.
      setRateDisplay((prev) => (Math.abs(prev - next) > 0.01 ? next : prev))
      setRotation(rotRef.current)

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTsRef.current = null
    }
  }, [])

  // Tear the engine down on unmount.
  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  // ---- platter drag handlers ------------------------------------------------
  const onGrab = () => {
    grabbedRef.current = true
    angVelRef.current = 0
    setActive(true)
    // A grab is a real user gesture — the one place we resume the context.
    void ensureAudio(host.audioContext())
  }

  const onSweep = (deltaRadians: number) => {
    // Convert this frame's angular delta to an angular velocity estimate and
    // low-pass it so the rate is smooth (no jitter spikes = no clicks).
    const last = lastTsRef.current
    const now = performance.now()
    const dt = last == null ? 1 / 60 : Math.max(0.001, (now - last) / 1000)
    const instVel = deltaRadians / dt
    // Blend toward the instantaneous velocity (heavier weight = snappier feel).
    angVelRef.current = angVelRef.current * 0.4 + instVel * 0.6
  }

  const onRelease = () => {
    grabbedRef.current = false
    setActive(false)
    // angVel keeps a little residual → a touch of throw before coasting to baseline.
  }

  // ---- spin / hold toggle ---------------------------------------------------
  const toggleSpin = () => {
    const next = !spinning
    setSpinning(next)
    // If not currently scratching, nudge the target immediately so the toggle
    // feels responsive (the RAF eases the rest).
  }

  const onSelect = (r: FragmentRef) => {
    setSelectedKey(refKey(r))
    setPickerOpen(false)
  }

  // ---- empty state ----------------------------------------------------------
  if (bank.length === 0) {
    return (
      <div className="bl-scr">
        <div className="bl-scr-bar" data-bl-nocapture>
          <div className="bl-scr-title">
            <Glyph name="wave" size={16} />
            <span>Scratch</span>
          </div>
        </div>
        <div className="bl-scr-empty">
          <Glyph name="wave" size={28} />
          <p className="bl-scr-empty-title">No snippet to scratch yet</p>
          <p className="bl-scr-empty-sub">
            Open <strong>Phrases</strong> to audition words and save them to your
            bank. Saved snippets can be loaded onto the turntable here.
          </p>
        </div>
      </div>
    )
  }

  const label = selected?.text ?? ""
  const langTag = selected?.language?.toUpperCase()

  return (
    <div className="bl-scr">
      <div className="bl-scr-bar" data-bl-nocapture>
        <div className="bl-scr-title">
          <Glyph name="wave" size={16} />
          <span>Scratch</span>
        </div>
        <div className="bl-scr-bar-actions">
          <button
            type="button"
            className="bl-scr-picker-btn"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
            title="Choose the snippet to scratch"
          >
            <span className="bl-scr-picker-cur" lang={selected?.language}>
              {label || "Pick a snippet"}
            </span>
            <Glyph name="chevron-down" size={14} />
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="bl-scr-picker" role="listbox" aria-label="Bank snippets" data-bl-nocapture>
          {[...bank].reverse().map((r) => {
            const k = refKey(r)
            const isSel = selected ? refKey(selected) === k : false
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={isSel}
                className={`bl-scr-picker-row${isSel ? " is-sel" : ""}`}
                onClick={() => onSelect(r)}
              >
                <span className="bl-scr-picker-text" lang={r.language}>
                  {r.text ?? "—"}
                </span>
                {r.language && (
                  <span className="bl-scr-picker-lang">{r.language.toUpperCase()}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="bl-scr-stage">
        <Platter
          rotation={rotation}
          label={label}
          langTag={langTag}
          active={active}
          reducedMotion={reduced}
          onGrab={onGrab}
          onSweep={onSweep}
          onRelease={onRelease}
        />

        <div className="bl-scr-readout" aria-live="off">
          {loading ? (
            <span className="bl-scr-loading">
              <span className="bl-scr-spin" /> loading…
            </span>
          ) : (
            <span className={`bl-scr-rate${isHeld(rateDisplay) ? " is-hold" : ""}`}>
              {fmtRate(rateDisplay)}
            </span>
          )}
        </div>
      </div>

      <div className="bl-scr-controls" data-bl-nocapture>
        <button
          type="button"
          className={`bl-scr-spinbtn${spinning ? " is-on" : ""}`}
          onClick={toggleSpin}
          aria-pressed={spinning}
          aria-label={spinning ? "Stop the record spinning (hold)" : "Spin the record"}
          disabled={loading || !selected}
        >
          <Glyph name={spinning ? "stop" : "play"} size={18} />
          <span>{spinning ? "Hold" : "Spin"}</span>
        </button>

        <div className="bl-scr-pitch" role="group" aria-label="Pitch (semitones)">
          <button
            type="button"
            className="bl-scr-pitch-btn"
            aria-label="Pitch down"
            onClick={() => setPitch((p) => Math.max(-12, p - 1))}
          >
            −
          </button>
          <span className="bl-scr-pitch-val">{fmtSemis(pitch)}</span>
          <button
            type="button"
            className="bl-scr-pitch-btn"
            aria-label="Pitch up"
            onClick={() => setPitch((p) => Math.min(12, p + 1))}
          >
            +
          </button>
        </div>
      </div>

      <p className="bl-scr-hint" data-bl-nocapture>
        Drag the record to scratch — backwards plays in reverse. Tap{" "}
        <strong>Spin</strong> to let it loop, then scratch over the top.
      </p>
    </div>
  )
}

/** Format a signed semitone value, e.g. "+3", "0", "−5". */
const fmtSemis = (n: number): string => {
  if (n === 0) return "0"
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`
}
