/**
 * beatlounge — the phrase-SCRATCH IMMERSIVE view: isolate ONE saved snippet and
 * scratch it like a record. The headline widget.
 *
 *   • PLATTER — a big vinyl the user drags. The disc's angular position maps
 *     DIRECTLY to a position in the snippet's buffer (1:1, no easing), so the
 *     record goes exactly where the finger puts it at any speed; the playbackRate
 *     handed to the engine each frame is just d(buffer-position)/d(real-time).
 *     A word is stretched across ~half the disc (slow, precise scrubbing) and a
 *     silent gap is baked between words so each word is separated + legible. The
 *     CURRENT word is printed on the rotating label.
 *   • RELEASE — the platter coasts with friction (turntable spin-down); a flick
 *     imparts momentum. While a finger owns the platter it tracks 1:1; the
 *     momentum physics are a separate, opt-in release layer.
 *   • SPIN/HOLD — parks the released baseline at a natural spin or a dead hold.
 *   • PITCH — an independent detune (granular decoupling) ±12 semitones.
 *   • PICKER — choose which bank snippet is loaded onto the turntable.
 *
 * The engine plays DIRECTLY on the shared AudioContext (a live instrument, not
 * the transport). Continuity is by construction: the looped GrainPlayer never
 * re-triggers, so moving the rate (even through zero / into reverse) is gapless.
 * We dispose the engine + RAF on unmount / snippet change.
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
import { buildGappedBuffer } from "./scratchBuffer"
import { createLoadToken } from "./loadToken"
import {
  advanceRotationByVel,
  angularVelocityToRate,
  clampRate,
  decayAngularVelocity,
  fmtRate,
  isHeld,
  rotationToBufferPos,
  SPIN_ANG_VEL,
  wordIndexAt,
  type WordSpan,
} from "./scratchMath"
import { Platter } from "./Platter"

const LOG = "[beatlounge/phrase-scratch]"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
}

/** A snippet's stable identity for picker selection + dedup. */
const refKey = (r: FragmentRef): string => `${r.language ?? ""}:${r.text ?? ""}:${r.voiceId ?? ""}`

/** Split a phrase into word tokens for per-word labels (best-effort). */
const splitWords = (text: string): string[] =>
  text.split(/\s+/).map((w) => w.trim()).filter(Boolean)

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
  const [spinning, setSpinning] = useState(false) // released baseline: spin vs hold
  const [pitch, setPitch] = useState(0)
  const [active, setActive] = useState(false) // a finger is on the platter
  const [rateDisplay, setRateDisplay] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [wordIdx, setWordIdx] = useState(-1)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Live engine + animation state live in refs (no re-render churn per frame).
  const engineRef = useRef<ScratchEngine | null>(null)
  const spinningRef = useRef(false) // released baseline: true = natural spin
  // Word spans (seconds) + per-word labels on the gapped buffer + its loop length.
  const spansRef = useRef<WordSpan[]>([])
  const wordsRef = useRef<(string | undefined)[]>([])
  const loopSecRef = useRef(0)

  const grabbedRef = useRef(false) // a finger owns the platter
  const discRotRef = useRef(0) // disc angular position (radians, the 1:1 truth)
  const prevDiscRotRef = useRef(0) // disc position last RAF frame (for the contact rate)
  const angVelRef = useRef(0) // coast angular velocity (rad/s), off-contact only
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  // Monotonic load token: a snippet change / unmount supersedes in-flight loads.
  const loadTokenRef = useRef(createLoadToken())

  spinningRef.current = spinning

  // ---- load the selected snippet onto the turntable -------------------------
  useEffect(() => {
    // Open a fresh load token FIRST: any in-flight load for a prior selection is
    // now stale and will discard its result at its next checkpoint.
    const token = loadTokenRef.current.open()
    const stale = () => !loadTokenRef.current.isCurrent(token)

    // Tear down any prior engine before loading the next snippet.
    engineRef.current?.dispose()
    engineRef.current = null
    spansRef.current = []
    wordsRef.current = []
    loopSecRef.current = 0
    discRotRef.current = 0
    angVelRef.current = 0
    setRateDisplay(0)
    setWordIdx(-1)

    if (!selected || !selected.text || !selected.language) {
      setLoading(false)
      return
    }

    // Snapshot the fields we need NOW so no later render's `selected` closure
    // can be read inside the async body (stale-closure race source).
    const text = selected.text
    const language = selected.language
    const voiceId = selected.voiceId
    const sha256 = selected.sha256

    setLoading(true)
    void (async () => {
      try {
        const ctx = host.audioContext()
        // NB: do NOT resume the context here — this effect runs on mount /
        // snippet change, NOT a user gesture. Resuming happens from `onGrab`.
        // Prefer cached bytes; resolve fresh (renders + caches) if absent.
        let bytes = sha256 ? await audioSource.getCachedAudio(sha256) : null
        if (stale()) return
        if (!bytes) {
          const resolved = await audioSource.resolveFragmentAudio(text, language, voiceId)
          if (stale()) return
          if (resolved.audio && resolved.audio.bytes.byteLength > 0) {
            bytes = resolved.audio
          }
        }
        if (!bytes) {
          console.warn(`${LOG} no audio bytes for snippet (synth-vox floor):`, text)
          host.toast("That snippet has no audio yet — open Phrases to render it")
          if (!stale()) setLoading(false)
          return
        }
        const decoded = await decodeFragmentBytes(ctx, bytes)
        if (stale()) return
        if (!decoded) {
          host.toast("Couldn't decode that snippet")
          setLoading(false)
          return
        }
        // Rebuild into a gapped buffer: words separated by baked silence.
        const gapped = buildGappedBuffer(ctx, decoded, splitWords(text))
        if (stale()) return
        spansRef.current = gapped.spans
        // Prefer the per-slot label; fall back to the whole phrase if unknown.
        wordsRef.current = gapped.words.map((w) => w ?? text)
        loopSecRef.current = gapped.totalSeconds

        const engine = createScratchEngine(ctx, gapped.buffer, {
          baselineRate: 0,
          gain: 0.95,
        })
        engine.setPitch(pitch)
        if (stale()) {
          engine.dispose()
          return
        }
        engineRef.current = engine
        setLoading(false)
      } catch (err) {
        console.warn(`${LOG} load failed:`, err)
        if (!stale()) {
          host.toast("Couldn't load that snippet")
          setLoading(false)
        }
      }
    })()

    return () => {
      // Invalidate on cleanup so an unmount (not just a re-run) discards a load.
      loadTokenRef.current.invalidate()
    }
    // pitch intentionally excluded: pitch changes are applied live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, host, audioSource])

  // Apply pitch live without reloading.
  useEffect(() => {
    engineRef.current?.setPitch(pitch)
  }, [pitch])

  // ---- the RAF loop: 1:1 follow on contact, momentum coast off it -----------
  useEffect(() => {
    const tick = (ts: number) => {
      const last = lastTsRef.current
      const dt = last == null ? 1 / 60 : Math.min(0.05, (ts - last) / 1000)
      lastTsRef.current = ts

      let rate: number
      if (grabbedRef.current) {
        // FAITHFUL: onSweep moved the disc to the finger; the rate this frame is
        // exactly the buffer motion that disc movement demands (no easing / low
        // pass — the record is where the finger is). Deriving the rate from the
        // disc's ACTUAL movement this frame means a stalled finger (no sweeps) →
        // 0 movement → silence, with no stored velocity to keep it droning.
        const moved = discRotRef.current - prevDiscRotRef.current
        rate = angularVelocityToRate(moved / dt)
        angVelRef.current = moved / dt // remembered so release can throw it
      } else {
        // RELEASED: friction-decay the coast. With Spin on, the decay floors at
        // the natural baseline spin (the record keeps looping); else it stops.
        const decayed = decayAngularVelocity(angVelRef.current, dt)
        angVelRef.current =
          spinningRef.current && decayed < SPIN_ANG_VEL ? SPIN_ANG_VEL : decayed
        discRotRef.current = advanceRotationByVel(discRotRef.current, angVelRef.current, dt)
        rate = angularVelocityToRate(angVelRef.current)
      }

      prevDiscRotRef.current = discRotRef.current

      const clamped = clampRate(rate)
      engineRef.current?.setRate(clamped)

      // The current word follows the buffer position (= disc position).
      const pos = rotationToBufferPos(discRotRef.current, loopSecRef.current)
      const wi = wordIndexAt(spansRef.current, pos, loopSecRef.current)

      // Throttle React state to ~every frame but only when it meaningfully moved.
      setRateDisplay((prev) => (Math.abs(prev - clamped) > 0.01 ? clamped : prev))
      setRotation(discRotRef.current)
      setWordIdx((prev) => (prev !== wi ? wi : prev))

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
    // Sync the prev marker so the first contact frame measures movement from
    // HERE (no spike from a stale coast position).
    prevDiscRotRef.current = discRotRef.current
    setActive(true)
    // A grab is a real user gesture — the one place we resume the context.
    void ensureAudio(host.audioContext())
  }

  const onSweep = (deltaRadians: number) => {
    // Move the disc to the finger 1:1 — this IS the truth. The RAF derives the
    // playbackRate from the disc's movement per frame, so this is the only place
    // the finger writes position; a stalled finger stops the record (silence).
    discRotRef.current += deltaRadians
  }

  const onRelease = () => {
    grabbedRef.current = false
    setActive(false)
    // angVel keeps the finger's last speed → a flick throws the platter, then it
    // coasts to rest (or to the baseline spin) under friction in the RAF.
  }

  // ---- spin / hold toggle ---------------------------------------------------
  const toggleSpin = () => setSpinning((v) => !v)

  const onSelect = (r: FragmentRef) => {
    setSelectedKey(refKey(r))
    setPickerOpen(false)
  }

  // ---- empty state ----------------------------------------------------------
  if (bank.length === 0) {
    return (
      <div className="bl-scr">
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
  // Word printed on the disc: the live slot if we have one, else the phrase.
  const discWord =
    wordIdx >= 0 && wordsRef.current[wordIdx] ? (wordsRef.current[wordIdx] as string) : label

  return (
    <div className="bl-scr">
      <div className="bl-scr-bar" data-bl-nocapture>
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
          word={discWord}
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
